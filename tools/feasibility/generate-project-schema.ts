import { z } from 'zod';
import { writeFile } from 'node:fs/promises';
import { projectSchemaV4 } from '../../packages/project-schema';
// The v1–v3 schemas and historical fixtures remain frozen.
await writeFile('packages/project-schema/project-v4.schema.json', JSON.stringify(z.toJSONSchema(projectSchemaV4), null, 2) + '\n');
