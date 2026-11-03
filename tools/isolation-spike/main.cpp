#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <userenv.h>
#include <aclapi.h>
#include <winioctl.h>
#include <array>
#include <cstdio>
#include <cstdlib>
#include <cwchar>
#include <filesystem>
#include <fstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <algorithm>
#include <vector>

namespace fs = std::filesystem;

struct Handle {
    HANDLE value = nullptr;
    ~Handle() { if (value && value != INVALID_HANDLE_VALUE) CloseHandle(value); }
    Handle() = default;
    Handle(const Handle&) = delete;
    Handle& operator=(const Handle&) = delete;
};

void require(bool ok, const char* step) {
    if (!ok) {
        fprintf(stderr, "%s failed (Win32 %lu)\n", step, GetLastError());
        throw std::runtime_error(step);
    }
}

struct Profile {
    std::wstring name;
    PSID sid = nullptr;
    ~Profile() {
        if (sid) {
            FreeSid(sid);
            DeleteAppContainerProfile(name.c_str());
        }
    }
};

struct Attributes {
    LPPROC_THREAD_ATTRIBUTE_LIST list = nullptr;
    ~Attributes() { if (list) DeleteProcThreadAttributeList(list); }
};

void grant(const fs::path& path, PSID sid, DWORD rights, DWORD inheritance = NO_INHERITANCE) {
    PACL existing = nullptr;
    PSECURITY_DESCRIPTOR descriptor = nullptr;
    auto status = GetNamedSecurityInfoW(path.c_str(), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION,
                                        nullptr, nullptr, &existing, nullptr, &descriptor);
    require(status == ERROR_SUCCESS, "read staging ACL");
    EXPLICIT_ACCESSW entry{};
    entry.grfAccessPermissions = rights;
    entry.grfAccessMode = GRANT_ACCESS;
    entry.grfInheritance = inheritance;
    entry.Trustee.TrusteeForm = TRUSTEE_IS_SID;
    entry.Trustee.TrusteeType = TRUSTEE_IS_UNKNOWN;
    entry.Trustee.ptstrName = static_cast<LPWSTR>(sid);
    PACL updated = nullptr;
    status = SetEntriesInAclW(1, &entry, existing, &updated);
    if (status == ERROR_SUCCESS) {
        status = SetNamedSecurityInfoW(const_cast<wchar_t*>(path.c_str()), SE_FILE_OBJECT,
                                       DACL_SECURITY_INFORMATION, nullptr, nullptr, updated, nullptr);
    }
    LocalFree(updated);
    LocalFree(descriptor);
    require(status == ERROR_SUCCESS, "grant staging ACL");
}

void requireContainer() {
    Handle token;
    DWORD sandboxed = 0, size = 0;
    require(OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token.value) &&
            GetTokenInformation(token.value, TokenIsAppContainer, &sandboxed, sizeof sandboxed, &size)
            && sandboxed, "child AppContainer token");
}

int probe() {
    const wchar_t* paths[] = {L"../outside/secret.txt", L"../outside/write.txt",
                             L"../outside/credential.txt", L"escape/secret.txt",
                             L"out/junction/secret.txt", L"out/junction/write.txt",
                             L"out/hard.txt", L"out/hard.txt", L"input.txt"};
    const char* names[] = {"external-read", "external-write", "credential-canary", "symlink-read",
                           "junction-read", "junction-write", "hard-link-read", "hard-link-write", "input-write"};
    bool passed = true;
    for (size_t i = 0; i < std::size(paths); ++i) {
        const bool write = i == 1 || i == 5 || i == 7 || i == 8;
        HANDLE file = CreateFileW(paths[i], write ? GENERIC_WRITE : GENERIC_READ,
                                  FILE_SHARE_READ, nullptr, OPEN_EXISTING, 0, nullptr);
        const auto error = GetLastError();
        if (file != INVALID_HANDLE_VALUE) CloseHandle(file);
        const bool denied = file == INVALID_HANDLE_VALUE && error == ERROR_ACCESS_DENIED;
        printf("%s=%s error=%lu\n", names[i], denied ? "denied" : "unverified", error);
        passed &= denied;
    }
    const bool environment = !GetEnvironmentVariableW(L"BTRK_SPIKE_CREDENTIAL", nullptr, 0) &&
                             !GetEnvironmentVariableW(L"USERPROFILE", nullptr, 0);
    printf("credential-environment=%s\n", environment ? "absent" : "present");
    WSADATA ws{};
    const auto networkStart = GetTickCount64();
    const int init = WSAStartup(MAKEWORD(2, 2), &ws);
    addrinfo hints{}, *addresses = nullptr;
    hints.ai_family = AF_INET;
    hints.ai_socktype = SOCK_STREAM;
    const int nameError = init == 0 ? getaddrinfo("localhost", nullptr, &hints, &addresses) : init;
    if (addresses) freeaddrinfo(addresses);
    printf("localhost-resolution=%d\n", nameError);
    const SOCKET socketHandle = init == 0 ? socket(AF_INET, SOCK_STREAM, IPPROTO_TCP) : INVALID_SOCKET;
    sockaddr_in endpoint{};
    endpoint.sin_family = AF_INET;
    endpoint.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    endpoint.sin_port = htons(49177);
    int error = init;
    if (init == 0 && socketHandle == INVALID_SOCKET) error = WSAGetLastError();
    if (socketHandle != INVALID_SOCKET) {
        u_long nonBlocking = 1;
        if (ioctlsocket(socketHandle, FIONBIO, &nonBlocking) == SOCKET_ERROR) {
            error = WSAGetLastError();
        } else if (connect(socketHandle, reinterpret_cast<const sockaddr*>(&endpoint),
                           sizeof endpoint) == SOCKET_ERROR) {
            error = WSAGetLastError();
            if (error == WSAEWOULDBLOCK) {
                fd_set writable, failed;
                FD_ZERO(&writable);
                FD_ZERO(&failed);
                FD_SET(socketHandle, &writable);
                FD_SET(socketHandle, &failed);
                timeval budget{1, 0};
                const int ready = select(0, nullptr, &writable, &failed, &budget);
                if (ready > 0) {
                    int length = sizeof error;
                    if (getsockopt(socketHandle, SOL_SOCKET, SO_ERROR,
                                   reinterpret_cast<char*>(&error), &length) == SOCKET_ERROR) {
                        error = WSAGetLastError();
                    }
                } else {
                    error = ready == 0 ? WSAETIMEDOUT : WSAGetLastError();
                }
            }
        }
    }
    const bool denied = error == WSAEACCES;
    printf("loopback-tcp=%s error=%d elapsed-ms=%llu\n",
           denied ? "denied" : error == 0 ? "connected" : "unverified", error,
           GetTickCount64() - networkStart);
    if (socketHandle != INVALID_SOCKET) closesocket(socketHandle);
    if (init == 0) WSACleanup();
    return passed && environment && denied ? 0 : 2;
}

int task(const std::wstring& mode) {
    requireContainer();
    if (mode == L"probe") return probe();
    if (mode == L"compile") {
        // Fixed resource compiler. No project-controlled language, executable or arguments.
        std::ifstream input("input.txt", std::ios::binary);
        std::array<char, 16> bytes{};
        input.read(bytes.data(), bytes.size());
        if (input.gcount() != 5 || std::string(bytes.data(), 5) != "FORGE") return 2;
        std::ofstream output("out/resource.bin", std::ios::binary);
        output.write("BTRK\x01\x05" "FORGE", 11);
        output.close();
        return output ? 0 : 2;
    }
    if (mode == L"memory") {
        void* allocation = VirtualAlloc(nullptr, 256 * 1024 * 1024,
                                       MEM_RESERVE | MEM_COMMIT, PAGE_READWRITE);
        if (allocation) VirtualFree(allocation, 0, MEM_RELEASE);
        return allocation == nullptr ? 0 : 2;
    }
    if (mode == L"logs") {
        for (int i = 0; i < 100000; ++i) puts("fixed spike output");
        return ferror(stdout) ? 2 : 0;
    }
    if (mode == L"sleep") {
        Sleep(INFINITE);
        return 2;
    }
    if (mode == L"cpu" || mode == L"cpu-control") {
        const auto end = GetTickCount64() + 1500;
        while (GetTickCount64() < end) YieldProcessor();
        return 0;
    }
    if (mode == L"tree") {
        wchar_t image[MAX_PATH]{};
        const DWORD length = GetModuleFileNameW(nullptr, image, MAX_PATH);
        if (!length || length == MAX_PATH) return 2;
        wchar_t command[] = L"spike.exe child sleep";
        STARTUPINFOW startup{};
        startup.cb = sizeof startup;
        PROCESS_INFORMATION process{};
        if (!CreateProcessW(image, command, nullptr, nullptr, FALSE, CREATE_NO_WINDOW,
                            nullptr, nullptr, &startup, &process)) return 2;
        printf("descendant=%lu\n", process.dwProcessId);
        fflush(stdout);
        CloseHandle(process.hThread);
        CloseHandle(process.hProcess);
        Sleep(INFINITE);
    }
    return 2;
}

struct Result {
    DWORD exitCode;
    bool interrupted;
    bool descendantObserved;
    bool treeStopped;
    unsigned long long cpuMilliseconds;
    size_t bytes;
    std::string log;
};

Result run(const fs::path& staging, PSID sid, const std::wstring& mode,
           DWORD timeout = 5000) {
    require(sid && IsValidSid(sid), "isolation preflight");
    Handle job, readPipe, writePipe, nul, process, thread;
    job.value = CreateJobObjectW(nullptr, nullptr);
    require(job.value != nullptr, "create Job Object");
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_JOB_MEMORY;
    limits.JobMemoryLimit = 96 * 1024 * 1024;
    require(SetInformationJobObject(job.value, JobObjectExtendedLimitInformation, &limits, sizeof limits),
            "configure Job Object");
    if (mode == L"cpu") {
        JOBOBJECT_CPU_RATE_CONTROL_INFORMATION cpu{};
        cpu.ControlFlags = JOB_OBJECT_CPU_RATE_CONTROL_ENABLE | JOB_OBJECT_CPU_RATE_CONTROL_HARD_CAP;
        cpu.CpuRate = 100;
        require(SetInformationJobObject(job.value, JobObjectCpuRateControlInformation, &cpu, sizeof cpu),
                "configure Job CPU cap");
    }
    SECURITY_ATTRIBUTES inherited{sizeof inherited, nullptr, TRUE};
    require(CreatePipe(&readPipe.value, &writePipe.value, &inherited, 0) &&
            SetHandleInformation(readPipe.value, HANDLE_FLAG_INHERIT, 0), "create log pipe");
    nul.value = CreateFileW(L"NUL", GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE, &inherited,
                            OPEN_EXISTING, 0, nullptr);
    require(nul.value != INVALID_HANDLE_VALUE, "open null stdin");
    HANDLE handles[] = {writePipe.value, nul.value};
    SECURITY_CAPABILITIES capabilities{sid, nullptr, 0, 0};
    SIZE_T bytes = 0;
    InitializeProcThreadAttributeList(nullptr, 2, 0, &bytes);
    std::vector<unsigned char> buffer(bytes);
    auto list = reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(buffer.data());
    require(InitializeProcThreadAttributeList(list, 2, 0, &bytes), "initialize process attributes");
    Attributes attributes{list};
    require(UpdateProcThreadAttribute(list, 0, PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES,
                                      &capabilities, sizeof capabilities, nullptr, nullptr) &&
            UpdateProcThreadAttribute(list, 0, PROC_THREAD_ATTRIBUTE_HANDLE_LIST,
                                      handles, sizeof handles, nullptr, nullptr), "apply process attributes");
    STARTUPINFOEXW startup{};
    startup.StartupInfo.cb = sizeof startup;
    startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
    startup.StartupInfo.hStdInput = nul.value;
    startup.StartupInfo.hStdOutput = writePipe.value;
    startup.StartupInfo.hStdError = writePipe.value;
    startup.lpAttributeList = list;
    PROCESS_INFORMATION child{};
    wchar_t windows[MAX_PATH]{};
    const UINT windowsLength = GetWindowsDirectoryW(windows, MAX_PATH);
    require(windowsLength && windowsLength < MAX_PATH, "resolve SystemRoot");
    std::wstring environment = L"BTRK_SPIKE=1";
    environment += L'\0';
    wchar_t localAppData[MAX_PATH]{};
    const DWORD localLength = GetEnvironmentVariableW(L"LOCALAPPDATA", localAppData, MAX_PATH);
    require(localLength && localLength < MAX_PATH, "resolve LOCALAPPDATA");
    environment += L"LOCALAPPDATA=";
    environment += localAppData;
    environment += L'\0';
    if (mode.compare(0, 5, L"msvc-") == 0) {
        environment += L"PATH=";
        environment += (staging / "msvc").native();
        environment += L'\0';
    }
    environment += L"SystemRoot=";
    environment += windows;
    environment += L'\0';
    for (const auto* key : {L"TEMP=", L"TMP="}) {
        environment += key;
        environment += (staging / "out").native();
        environment += L'\0';
    }
    fs::path executable = staging / "spike.exe";
    std::wstring command = L"spike.exe child " + (mode == L"crash" ? L"tree" : mode);
    if (mode == L"msvc-compile") {
        executable = staging / "msvc/cl.exe";
        command = L"cl.exe /nologo /c /GS- /Zl /Brepro /Foout/sample.obj sample.c";
    } else if (mode == L"msvc-link") {
        executable = staging / "msvc/link.exe";
        command = L"link.exe /nologo /nodefaultlib /entry:entry /subsystem:console /Brepro /out:out/sample.exe out/sample.obj";
    } else if (mode == L"msvc-execute") {
        executable = staging / "out/sample.exe";
        command = L"sample.exe";
    }
    require(CreateProcessW(executable.c_str(), command.data(), nullptr, nullptr, TRUE,
                           CREATE_SUSPENDED | CREATE_NO_WINDOW | EXTENDED_STARTUPINFO_PRESENT |
                           CREATE_UNICODE_ENVIRONMENT, environment.data(), staging.c_str(), &startup.StartupInfo, &child),
            "create suspended AppContainer process");
    process.value = child.hProcess;
    thread.value = child.hThread;
    Handle token;
    DWORD sandboxed = 0, returned = 0;
    if (!OpenProcessToken(process.value, TOKEN_QUERY, &token.value) ||
        !GetTokenInformation(token.value, TokenIsAppContainer, &sandboxed, sizeof sandboxed, &returned) ||
        !sandboxed || !AssignProcessToJobObject(job.value, process.value) ||
        ResumeThread(thread.value) == DWORD(-1)) {
        const DWORD error = GetLastError();
        TerminateProcess(process.value, 3);
        WaitForSingleObject(process.value, 5000);
        SetLastError(error);
        require(false, "attach Job and resume");
    }
    CloseHandle(writePipe.value);
    writePipe.value = nullptr;
    Result result{};
    std::array<char, 4096> chunk{};
    result.log.reserve(chunk.size());
    std::thread drain([&] {
        DWORD count = 0;
        while (ReadFile(readPipe.value, chunk.data(), static_cast<DWORD>(chunk.size()), &count, nullptr) && count) {
            result.bytes += count;
            result.log.append(chunk.data(), (std::min)(static_cast<size_t>(count), chunk.size() - result.log.size()));
        }
    });
    const bool cancel = mode == L"tree" || mode == L"crash";
    if (cancel) {
        for (int attempt = 0; attempt < 100; ++attempt) {
            JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting{};
            if (QueryInformationJobObject(job.value, JobObjectBasicAccountingInformation,
                                          &accounting, sizeof accounting, nullptr) &&
                accounting.ActiveProcesses >= 2) {
                result.descendantObserved = true;
                break;
            }
            Sleep(20);
        }
    }
    if (mode == L"crash" && result.descendantObserved) {
        struct ProcessList {
            DWORD assigned;
            DWORD listed;
            ULONG_PTR pids[32];
        } processes{};
        const BOOL listed = QueryInformationJobObject(job.value, JobObjectBasicProcessIdList,
                                                       &processes, sizeof processes, nullptr);
        if (listed && processes.listed >= 2 && processes.listed <= std::size(processes.pids)) {
            printf("crash-children=");
            for (DWORD i = 0; i < processes.listed; ++i) {
                printf("%s%llu", i ? "," : "", static_cast<unsigned long long>(processes.pids[i]));
            }
            puts("");
            fflush(stdout);
            Sleep(INFINITE); // The external harness terminates this host while the Job handle is open.
        }
        printf("crash-job-list failed error=%lu listed=%lu\n", GetLastError(), processes.listed);
    }
    const auto wait = cancel ? WAIT_TIMEOUT : WaitForSingleObject(process.value, timeout);
    result.interrupted = wait == WAIT_TIMEOUT;
    const BOOL terminated = TerminateJobObject(job.value, 42);
    for (int attempt = 0; terminated && attempt < 250; ++attempt) {
        JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting{};
        if (QueryInformationJobObject(job.value, JobObjectBasicAccountingInformation,
                                      &accounting, sizeof accounting, nullptr) &&
            accounting.ActiveProcesses == 0) {
            result.treeStopped = true;
            result.cpuMilliseconds = static_cast<unsigned long long>(accounting.TotalUserTime.QuadPart +
                                                                     accounting.TotalKernelTime.QuadPart) / 10000;
            break;
        }
        Sleep(20);
    }
    CloseHandle(job.value);
    job.value = nullptr;
    const auto stopped = WaitForSingleObject(process.value, 5000);
    drain.join();
    require(terminated && stopped == WAIT_OBJECT_0 && wait != WAIT_FAILED, "stop Job tree");
    require(GetExitCodeProcess(process.value, &result.exitCode), "read exit code");
    return result;
}

bool makeJunction(const fs::path& link, const fs::path& target) {
    fs::create_directory(link);
    Handle directory;
    directory.value = CreateFileW(link.c_str(), GENERIC_WRITE, 0, nullptr, OPEN_EXISTING,
                                  FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS, nullptr);
    if (directory.value == INVALID_HANDLE_VALUE) return false;
    struct MountPoint {
        DWORD tag;
        WORD dataLength, reserved;
        WORD substituteOffset, substituteLength, printOffset, printLength;
        wchar_t paths[2 * MAX_PATH + 8];
    } data{};
    const std::wstring substitute = L"\\??\\" + target.native();
    const auto print = target.native();
    if (substitute.size() + print.size() + 2 > std::size(data.paths)) return false;
    data.tag = IO_REPARSE_TAG_MOUNT_POINT;
    data.substituteLength = static_cast<WORD>(substitute.size() * sizeof(wchar_t));
    data.printOffset = data.substituteLength + sizeof(wchar_t);
    data.printLength = static_cast<WORD>(print.size() * sizeof(wchar_t));
    data.dataLength = data.printOffset + data.printLength + 10;
    std::copy(substitute.begin(), substitute.end(), data.paths);
    std::copy(print.begin(), print.end(), data.paths + data.printOffset / sizeof(wchar_t));
    DWORD returned = 0;
    return DeviceIoControl(directory.value, FSCTL_SET_REPARSE_POINT, &data, data.dataLength + 8,
                           nullptr, 0, &returned, nullptr) != FALSE;
}

bool inspectFile(const fs::path& path, Handle& file, BY_HANDLE_FILE_INFORMATION& identity) {
    file.value = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING,
                             FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS, nullptr);
    return file.value != INVALID_HANDLE_VALUE &&
           GetFileInformationByHandle(file.value, &identity) &&
           !(identity.dwFileAttributes & (FILE_ATTRIBUTE_REPARSE_POINT | FILE_ATTRIBUTE_DIRECTORY)) &&
           identity.nNumberOfLinks == 1;
}

void pinDirectory(const fs::path& path, Handle& directory) {
    directory.value = CreateFileW(path.c_str(), FILE_READ_ATTRIBUTES, FILE_SHARE_READ | FILE_SHARE_WRITE,
                                  nullptr, OPEN_EXISTING,
                                  FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS, nullptr);
    BY_HANDLE_FILE_INFORMATION info{};
    require(directory.value != INVALID_HANDLE_VALUE &&
            GetFileInformationByHandle(directory.value, &info) &&
            (info.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) &&
            !(info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT), "pin staging directory");
}

bool sameFile(const BY_HANDLE_FILE_INFORMATION& first, const BY_HANDLE_FILE_INFORMATION& second) {
    return first.dwVolumeSerialNumber == second.dwVolumeSerialNumber &&
           first.nFileIndexHigh == second.nFileIndexHigh && first.nFileIndexLow == second.nFileIndexLow;
}

int testPendingFileCases(const fs::path& base) {
    const auto stage = base / "stage";
    const auto out = stage / "out";
    const auto input = stage / "input.txt";
    const auto output = out / "sample.bin";
    fs::create_directory(stage);
    fs::create_directory(out);
    std::ofstream(input) << "original";
    std::ofstream(stage / "replacement.txt") << "replacement";
    std::ofstream(output) << "synthetic artifact";

    Handle root, expected, actual;
    pinDirectory(base, root);
    BY_HANDLE_FILE_INFORMATION expectedId{}, actualId{};
    require(inspectFile(input, expected, expectedId), "capture expected identity");
    CloseHandle(expected.value);
    expected.value = nullptr;
    require(MoveFileExW((stage / "replacement.txt").c_str(), input.c_str(),
                        MOVEFILE_REPLACE_EXISTING) != FALSE, "replace before opening");
    const bool staleRejected = inspectFile(input, actual, actualId) && !sameFile(expectedId, actualId);

    Handle stagePin, outPin, collected;
    pinDirectory(stage, stagePin);
    pinDirectory(out, outPin);
    BY_HANDLE_FILE_INFORMATION collectedId{};
    require(inspectFile(output, collected, collectedId), "open synthetic artifact");

    bool ancestorMoved = false, artifactMoved = false, aliasCreated = false;
    DWORD ancestorError = 0, artifactError = 0, aliasError = 0;
    const auto alias = base / "late-hard-link.bin";
    std::thread attacker([&] {
        ancestorMoved = MoveFileExW(stage.c_str(), (base / "moved-stage").c_str(), 0) != FALSE;
        ancestorError = ancestorMoved ? 0 : GetLastError();
        artifactMoved = MoveFileExW(output.c_str(), (out / "moved-artifact.bin").c_str(), 0) != FALSE;
        artifactError = artifactMoved ? 0 : GetLastError();
        aliasCreated = CreateHardLinkW(alias.c_str(), output.c_str(), nullptr) != FALSE;
        aliasError = aliasCreated ? 0 : GetLastError();
    });
    attacker.join();
    BY_HANDLE_FILE_INFORMATION after{};
    require(GetFileInformationByHandle(collected.value, &after), "recheck collection identity");
    const bool hardLinkDetected = aliasCreated && sameFile(collectedId, after) && after.nNumberOfLinks > 1;

    const auto symbolic = out / "symbolic.bin";
    const bool symlink = CreateSymbolicLinkW(symbolic.c_str(), input.c_str(),
                                            SYMBOLIC_LINK_FLAG_ALLOW_UNPRIVILEGED_CREATE) != FALSE;
    const DWORD symlinkError = symlink ? 0 : GetLastError();
    Handle symbolicHandle;
    BY_HANDLE_FILE_INFORMATION symbolicId{};
    const bool symlinkRejected = symlink && !inspectFile(symbolic, symbolicHandle, symbolicId) &&
                                 (symbolicId.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT);

    printf("before-open identity-mismatch=%d\n", staleRejected);
    printf("ancestor rename=%d error=%lu\n", ancestorMoved, ancestorError);
    printf("collection rename=%d error=%lu\n", artifactMoved, artifactError);
    printf("late-hard-link created=%d error=%lu links=%lu detected=%d\n",
           aliasCreated, aliasError, after.nNumberOfLinks, hardLinkDetected);
    printf("symlink created=%d error=%lu rejected=%d\n", symlink, symlinkError, symlinkRejected);
    // Detection alone does not close a race after the final identity check.
    return staleRejected && !ancestorMoved && ancestorError == ERROR_SHARING_VIOLATION &&
           !artifactMoved && artifactError == ERROR_SHARING_VIOLATION &&
           !aliasCreated && aliasError == ERROR_SHARING_VIOLATION && symlinkRejected ? 0 : 1;
}

bool testFileBoundary(const fs::path& stage) {
    const auto outside = stage.parent_path() / "outside";
    const auto out = stage / "out";
    const auto source = stage / "input.txt";
    const auto canary = outside / "secret.txt";
    const bool hard = CreateHardLinkW((out / "hard.txt").c_str(), canary.c_str(), nullptr) != FALSE;
    const bool junction = makeJunction(out / "junction", outside);
    const bool symlink = CreateSymbolicLinkW((out / "symbolic.txt").c_str(), canary.c_str(),
                                            SYMBOLIC_LINK_FLAG_ALLOW_UNPRIVILEGED_CREATE) != FALSE;
    Handle input, alias, original, mount, symbolic;
    BY_HANDLE_FILE_INFORMATION identity{}, other{}, originalIdentity{};
    const bool regular = inspectFile(source, input, identity);
    const bool hardRejected = hard && !inspectFile(out / "hard.txt", alias, other) &&
                              other.nNumberOfLinks >= 2 && !inspectFile(canary, original, originalIdentity) &&
                              originalIdentity.nNumberOfLinks >= 2 && sameFile(other, originalIdentity);
    const bool junctionRejected = junction && !inspectFile(out / "junction", mount, other) &&
                                  (other.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT);
    const bool symlinkRejected = symlink && !inspectFile(out / "symbolic.txt", symbolic, other) &&
                                 (other.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT);
    DWORD raceError = 0;
    bool renamed = false;
    std::thread swap([&] {
        renamed = MoveFileExW(source.c_str(), (out / "swapped.txt").c_str(), 0) != FALSE;
        raceError = renamed ? 0 : GetLastError();
    });
    swap.join();
    BY_HANDLE_FILE_INFORMATION after{};
    const bool pinned = regular && !renamed && raceError == ERROR_SHARING_VIOLATION &&
                        GetFileInformationByHandle(input.value, &after) &&
                        sameFile(identity, after);
    printf("file-boundary regular=%d hard-link=%d junction=%d symlink=%d pinned-swap=%d race-error=%lu\n",
           regular, hardRejected, junctionRejected, symlinkRejected, pinned, raceError);
    return regular && hardRejected && junctionRejected && symlinkRejected && pinned;
}

bool verifyPe(const fs::path& path) {
    Handle artifact;
    BY_HANDLE_FILE_INFORMATION identity{};
    if (!inspectFile(path, artifact, identity)) return false;
    IMAGE_DOS_HEADER dos{};
    IMAGE_NT_HEADERS64 nt{};
    DWORD bytes = 0;
    return ReadFile(artifact.value, &dos, sizeof dos, &bytes, nullptr) && bytes == sizeof dos &&
           dos.e_magic == IMAGE_DOS_SIGNATURE && dos.e_lfanew > 0 &&
           SetFilePointer(artifact.value, dos.e_lfanew, nullptr, FILE_BEGIN) != INVALID_SET_FILE_POINTER &&
           ReadFile(artifact.value, &nt, sizeof nt, &bytes, nullptr) && bytes == sizeof nt &&
           nt.Signature == IMAGE_NT_SIGNATURE && nt.FileHeader.Machine == IMAGE_FILE_MACHINE_AMD64 &&
           nt.OptionalHeader.Magic == IMAGE_NT_OPTIONAL_HDR64_MAGIC &&
           nt.OptionalHeader.Subsystem == IMAGE_SUBSYSTEM_WINDOWS_CUI &&
           nt.OptionalHeader.AddressOfEntryPoint != 0;
}

int wmain(int argc, wchar_t** argv) {
    try {
        if (argc == 3 && std::wstring(argv[1]) == L"child") return task(argv[2]);
        const bool crash = argc == 2 && std::wstring(argv[1]) == L"--crash-test";
        const bool files = argc == 2 && std::wstring(argv[1]) == L"--pending-file-tests";
        if (argc != 1 && !crash && !files) return 2;
        wchar_t image[MAX_PATH]{};
        const DWORD length = GetModuleFileNameW(nullptr, image, MAX_PATH);
        require(length > 0 && length < MAX_PATH, "resolve host image");
        const fs::path base = fs::absolute(fs::path(image).parent_path() /
            (L"run-" + std::to_wstring(GetCurrentProcessId()) + L"-" + std::to_wstring(GetTickCount64())));
        require(fs::create_directory(base), "create exclusive root");
        if (files) return testPendingFileCases(base);
        const auto staging = base / "stage";
        fs::create_directory(staging);
        fs::create_directory(staging / "out");
        fs::create_directory(base / "outside");
        Handle runDirectory, stageDirectory, outDirectory;
        pinDirectory(base, runDirectory);
        pinDirectory(staging, stageDirectory);
        pinDirectory(staging / "out", outDirectory);
        std::ofstream(staging / "input.txt") << "FORGE";
        for (const auto* name : {"secret.txt", "write.txt", "credential.txt"}) {
            std::ofstream(base / "outside" / name) << "synthetic-canary";
        }
        fs::copy_file(image, staging / "spike.exe");
        // Directory symlink creation may need Developer Mode or privilege.
        const bool link = !crash && CreateSymbolicLinkW((staging / "escape").c_str(), (base / "outside").c_str(),
                                              SYMBOLIC_LINK_FLAG_DIRECTORY |
                                              SYMBOLIC_LINK_FLAG_ALLOW_UNPRIVILEGED_CREATE) != FALSE;
        printf("escape-fixture=%s\n", link ? "symlink" : "unavailable");
        Profile profile{base.filename().wstring() + L"-BTRK"};
        const auto status = CreateAppContainerProfile(profile.name.c_str(), L"BTRK isolation spike",
                                                      L"Temporary proof profile", nullptr, 0, &profile.sid);
        printf("CreateAppContainerProfile=0x%08lx\n", static_cast<unsigned long>(status));
        require(SUCCEEDED(status), "create AppContainer profile");
        grant(base, profile.sid, FILE_GENERIC_READ | FILE_GENERIC_EXECUTE);
        grant(staging, profile.sid, FILE_GENERIC_READ | FILE_GENERIC_EXECUTE);
        grant(staging / "spike.exe", profile.sid, FILE_GENERIC_READ | FILE_GENERIC_EXECUTE);
        grant(staging / "input.txt", profile.sid, FILE_GENERIC_READ);
        grant(staging / "out", profile.sid, FILE_GENERIC_READ | FILE_GENERIC_WRITE | FILE_GENERIC_EXECUTE,
              SUB_CONTAINERS_AND_OBJECTS_INHERIT);
        if (crash) {
            printf("crash-root=%ls\n", base.filename().c_str());
            fflush(stdout);
            const auto outcome = run(staging, profile.sid, L"crash");
            printf("crash-fixture-unready descendant=%d exit=%lu\n%s", outcome.descendantObserved,
                   outcome.exitCode, outcome.log.c_str());
            return 2;
        }
        _wputenv_s(L"BTRK_SPIKE_CREDENTIAL", L"synthetic-canary");
        bool passed = testFileBoundary(staging);
        const auto control = run(staging, profile.sid, L"cpu-control");
        const auto limited = run(staging, profile.sid, L"cpu");
        const bool cpuReduced = control.exitCode == 0 && limited.exitCode == 0 &&
                                control.cpuMilliseconds > 500 &&
                                limited.cpuMilliseconds * 2 < control.cpuMilliseconds;
        printf("cpu=%s control-ms=%llu capped-ms=%llu\n", cpuReduced ? "PASS" : "inconclusive",
               control.cpuMilliseconds, limited.cpuMilliseconds);
        passed &= cpuReduced;
        for (const auto* mode : {L"compile", L"probe", L"memory", L"logs", L"sleep", L"tree"}) {
            const auto result = run(staging, profile.sid, mode, std::wstring(mode) == L"sleep" ? 250 : 5000);
            const std::wstring kind(mode);
            bool ok = result.exitCode == 0;
            if (kind == L"compile") {
                std::ifstream output(staging / "out/resource.bin", std::ios::binary);
                const std::string content{std::istreambuf_iterator<char>(output), {}};
                ok &= content == std::string("BTRK\x01\x05" "FORGE", 11);
            }
            if (kind == L"logs") ok &= result.bytes > 4096 && result.log.size() == 4096;
            if (kind == L"sleep") ok = result.interrupted && result.exitCode == 42;
            if (kind == L"tree") ok = result.descendantObserved && result.treeStopped && result.exitCode == 42;
            printf("%ls=%s exit=%lu bytes=%zu retained=%zu job-empty=%s\n", mode, ok ? "PASS" : "FAIL",
                   result.exitCode, result.bytes, result.log.size(), result.treeStopped ? "yes" : "unverified");
            if (kind == L"probe" || kind == L"tree") printf("%s", result.log.c_str());
            passed &= ok;
        }
        try {
            run(staging, nullptr, L"compile");
            passed = false;
        } catch (const std::runtime_error&) {
            puts("fail-closed-preflight=PASS (missing SID)");
        }
        const auto provisioned = fs::path(image).parent_path() / "msvc-pinned";
        if (fs::is_directory(provisioned)) {
            fs::create_directory(staging / "msvc");
            grant(staging / "msvc", profile.sid, FILE_GENERIC_READ | FILE_GENERIC_EXECUTE);
            fs::create_directory(staging / "msvc/1046");
            grant(staging / "msvc/1046", profile.sid, FILE_GENERIC_READ | FILE_GENERIC_EXECUTE);
            for (const auto* tool : {"cl.exe", "link.exe", "c1.dll", "c2.dll", "msobj140.dll",
                                     "mspdb140.dll", "mspdbcore.dll", "mspdbsrv.exe", "mspdbst.dll",
                                     "msvcp140.dll", "msvcp140_atomic_wait.dll", "tbbmalloc.dll",
                                     "vcruntime140.dll", "vcruntime140_1.dll",
                                     "1046/clui.dll", "1046/linkui.dll"}) {
                const auto destination = staging / "msvc" / tool;
                fs::copy_file(provisioned / tool, destination);
                grant(destination, profile.sid, FILE_GENERIC_READ | FILE_GENERIC_EXECUTE);
            }
            std::ofstream(staging / "sample.c") << "int entry(void) { return 42; }\n";
            grant(staging / "sample.c", profile.sid, FILE_GENERIC_READ);
            const auto compile = run(staging, profile.sid, L"msvc-compile");
            printf("msvc-compile exit=%lu\n%s", compile.exitCode, compile.log.c_str());
            if (compile.exitCode == 0) {
                const auto linkResult = run(staging, profile.sid, L"msvc-link");
                const bool verified = linkResult.exitCode == 0 && verifyPe(staging / "out/sample.exe");
                printf("msvc-link exit=%lu verified-pe=%d\n%s", linkResult.exitCode, verified,
                       linkResult.log.c_str());
                passed &= verified;
                if (verified) {
                    grant(staging / "out/sample.exe", profile.sid, FILE_GENERIC_READ | FILE_GENERIC_EXECUTE);
                    const auto executed = run(staging, profile.sid, L"msvc-execute");
                    printf("msvc-execute exit=%lu interrupted=%d\n", executed.exitCode, executed.interrupted);
                    passed &= executed.exitCode == 42 && !executed.interrupted;
                }
            } else {
                passed = false;
            }
        } else {
            puts("msvc=unverified (provisioning unavailable)");
            passed = false;
        }
        return passed ? 0 : 1;
    } catch (const std::exception& error) {
        fprintf(stderr, "Spike aborted: %s\n", error.what());
        return 1;
    }
}
