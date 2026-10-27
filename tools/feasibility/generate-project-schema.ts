import { z } from 'zod';
import { writeFile } from 'node:fs/promises';
import { projectSchema } from '../../packages/project-schema';
import { exampleProject } from '../../packages/forge-core/example';
await writeFile('packages/project-schema/project.schema.json', JSON.stringify(z.toJSONSchema(projectSchema), null, 2) + '\n');
// Historical fixtures and the frozen v1 schema must never be regenerated from the new model.
await writeFile('tests/fixtures/projects/visual-v2.json', JSON.stringify(exampleProject(), null, 2) + '\n');
