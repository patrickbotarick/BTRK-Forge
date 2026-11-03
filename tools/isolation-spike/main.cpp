#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <windows.h>
#include <userenv.h>
#include <aclapi.h>
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

void grant(const fs::path& path, PSID sid, DWORD rights) {
    PACL existing = nullptr;
    PSECURITY_DESCRIPTOR descriptor = nullptr;
    auto status = GetNamedSecurityInfoW(path.c_str(), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION,
                                        nullptr, nullptr, &existing, nullptr, &descriptor);
    require(status == ERROR_SUCCESS, "read staging ACL");
    EXPLICIT_ACCESSW entry{};
    entry.grfAccessPermissions = rights;
    entry.grfAccessMode = GRANT_ACCESS;
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
                             L"../outside/credential.txt", L"escape/secret.txt"};
    const char* names[] = {"external-read", "external-write", "credential-canary", "symlink-read"};
    bool passed = true;
    for (int i = 0; i < 4; ++i) {
        HANDLE file = CreateFileW(paths[i], i == 1 ? GENERIC_WRITE : GENERIC_READ,
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
    const int init = WSAStartup(MAKEWORD(2, 2), &ws);
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
    printf("loopback-tcp=%s error=%d\n", denied ? "denied" : error == 0 ? "connected" : "unverified", error);
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
    environment += L"SystemRoot=";
    environment += windows;
    environment += L'\0';
    for (const auto* key : {L"TEMP=", L"TMP="}) {
        environment += key;
        environment += (staging / "out").native();
        environment += L'\0';
    }
    std::wstring command = L"spike.exe child " + mode;
    require(CreateProcessW((staging / "spike.exe").c_str(), command.data(), nullptr, nullptr, TRUE,
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
    const bool cancel = mode == L"tree";
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
    const auto wait = cancel ? WAIT_TIMEOUT : WaitForSingleObject(process.value, timeout);
    result.interrupted = wait == WAIT_TIMEOUT;
    const BOOL terminated = TerminateJobObject(job.value, 42);
    for (int attempt = 0; terminated && attempt < 250; ++attempt) {
        JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting{};
        if (QueryInformationJobObject(job.value, JobObjectBasicAccountingInformation,
                                      &accounting, sizeof accounting, nullptr) &&
            accounting.ActiveProcesses == 0) {
            result.treeStopped = true;
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

int wmain(int argc, wchar_t** argv) {
    try {
        if (argc == 3 && std::wstring(argv[1]) == L"child") return task(argv[2]);
        if (argc != 1) return 2;
        wchar_t image[MAX_PATH]{};
        const DWORD length = GetModuleFileNameW(nullptr, image, MAX_PATH);
        require(length > 0 && length < MAX_PATH, "resolve host image");
        const fs::path base = fs::absolute(fs::path(image).parent_path() /
            (L"run-" + std::to_wstring(GetCurrentProcessId()) + L"-" + std::to_wstring(GetTickCount64())));
        require(fs::create_directory(base), "create exclusive root");
        const auto staging = base / "stage";
        fs::create_directory(staging);
        fs::create_directory(staging / "out");
        fs::create_directory(base / "outside");
        std::ofstream(staging / "input.txt") << "FORGE";
        for (const auto* name : {"secret.txt", "write.txt", "credential.txt"}) {
            std::ofstream(base / "outside" / name) << "synthetic-canary";
        }
        fs::copy_file(image, staging / "spike.exe");
        // Directory symlink creation may need Developer Mode or privilege.
        const bool link = CreateSymbolicLinkW((staging / "escape").c_str(), (base / "outside").c_str(),
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
        grant(staging / "out", profile.sid, FILE_GENERIC_READ | FILE_GENERIC_WRITE | FILE_GENERIC_EXECUTE);
        _wputenv_s(L"BTRK_SPIKE_CREDENTIAL", L"synthetic-canary");
        bool passed = true;
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
        return passed ? 0 : 1;
    } catch (const std::exception& error) {
        fprintf(stderr, "Spike aborted: %s\n", error.what());
        return 1;
    }
}
