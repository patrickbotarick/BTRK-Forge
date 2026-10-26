import { expect, it } from 'vitest';
import { validateInHelper } from '../tools/feasibility/broker';
import { exampleProject } from '../packages/forge-core/example';
it('helper isolado aceita somente projeto declarativo validado', async () => {
  expect(await validateInHelper(exampleProject())).toEqual({ ok: true, projectId: 'counter-project' });
  expect(await validateInHelper({ command: 'whoami' })).toMatchObject({ ok: false });
});
