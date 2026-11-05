import type { KnowledgeColumnType, KnowledgeSchemaConfirmation, KnowledgeTabularSchema } from '@mind2flow/agents-sdk';

/**
 * Edits a user asks for on the command line, applied on top of the mapping
 * GraphOS proposed. Columns are addressed by header or by field name, so
 * `--type precio=number` works whichever of the two the user is looking at.
 */
export interface MappingEdits {
  nameField?: string;
  entityType?: string;
  /** "column=type" */
  types?: string[];
  /** "column" */
  exclude?: string[];
  /** "column" */
  include?: string[];
  /** "column=newField" */
  renames?: string[];
}

const TYPES: KnowledgeColumnType[] = ['text', 'number', 'date'];

function pair(raw: string, flag: string): [string, string] {
  const at = raw.lastIndexOf('=');
  if (at <= 0 || at === raw.length - 1) throw new Error(`${flag} expects column=value, got "${raw}"`);
  return [raw.slice(0, at).trim(), raw.slice(at + 1).trim()];
}

/** Build the confirmation body: the proposal, with the user's edits applied. */
export function applyMappingEdits(schema: KnowledgeTabularSchema, edits: MappingEdits): KnowledgeSchemaConfirmation {
  const columns = schema.columns.map(({ header, field, type, include }) => ({
    header,
    field,
    type: type ?? 'text',
    include: include ?? true,
  }));

  const find = (name: string, flag: string) => {
    const lower = name.toLowerCase();
    const column = columns.find((c) => c.header.toLowerCase() === lower)
      ?? columns.find((c) => c.field.toLowerCase() === lower);
    if (!column) {
      throw new Error(`${flag}: no column "${name}". Columns: ${columns.map((c) => `${c.header} (${c.field})`).join(', ')}`);
    }
    return column;
  };

  // The proposed name column, held by reference so a --rename of it carries over.
  const proposedName = schema.name_field ? columns.find((c) => c.field === schema.name_field) : undefined;

  for (const raw of edits.renames ?? []) {
    const [name, field] = pair(raw, '--rename');
    find(name, '--rename').field = field;
  }
  for (const raw of edits.types ?? []) {
    const [name, type] = pair(raw, '--type');
    if (!TYPES.includes(type as KnowledgeColumnType)) throw new Error(`--type: "${type}" is not one of ${TYPES.join(', ')}`);
    find(name, '--type').type = type as KnowledgeColumnType;
  }
  for (const name of edits.exclude ?? []) find(name, '--exclude').include = false;
  for (const name of edits.include ?? []) find(name, '--include').include = true;

  const nameField = edits.nameField
    ? find(edits.nameField, '--name-field').field
    : proposedName?.field ?? schema.name_field;
  if (!nameField) throw new Error('GraphOS proposed no name column for this file: pass --name-field <column>');
  const named = columns.find((c) => c.field === nameField);
  if (!named?.include) throw new Error(`The name column "${nameField}" must be included`);

  const included = columns.filter((c) => c.include).map((c) => c.field);
  const repeated = included.find((f, i) => included.indexOf(f) !== i);
  if (repeated) throw new Error(`Two included columns would both be called "${repeated}" — rename one with --rename`);

  return { columns, name_field: nameField, entity_type: edits.entityType ?? schema.entity_type ?? 'Product' };
}
