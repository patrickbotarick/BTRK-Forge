import { describe, expect, it } from 'vitest';
import { VisitBudget, checkScalar } from '../../packages/semantic-runtime/primitives';
import { SemanticRuntime } from '../../packages/semantic-runtime';
import { lowerBlueprint } from '../../packages/blueprint-ir';
import { logicFixture } from '../logic-fixture';

describe('Shared basic operations: independent boundaries', () => {
  it('allows exactly 10000 visits and counts repeated nodes', () => {
    const executed = new Set<string>(), budget = new VisitBudget(executed);
    for (let i = 0; i < 10000; i++) budget.visit('same');
    expect(executed.size).toBe(1); expect(() => budget.visit('overflow')).toThrow('Limite de execução excedido');
    expect([...executed]).toEqual(['same', 'overflow']);
  });
  it('checks UTF-16 lengths and finite results without coercing values', () => {
    expect(checkScalar('😀'.repeat(500), 'text')).toHaveLength(1000);
    expect(() => checkScalar('😀'.repeat(500) + 'x', 'text')).toThrow('1000');
    for (const value of [Infinity, -Infinity, NaN]) expect(() => checkScalar(value, 'number')).toThrow('não finito');
    expect(Object.is(checkScalar(-0, 'number'), -0)).toBe(true);
  });
  it('retains input ingestion on rollback and detaches both commit and rollback state', () => {
    const lowered = lowerBlueprint(logicFixture()); if (!lowered.ok) throw Error('fixture');
    const ctx = new SemanticRuntime(lowered.ir), base = ctx.initialState();
    ctx.ingestInput(base, 'name-input', 'Ana'); const transaction = ctx.beginActions(base);
    ctx.writeText(transaction.working, 'result-text', 'Changed'); ctx.writeVariable(transaction.working, 'name', 'Bia');
    const rolled = ctx.rollback(transaction), committed = ctx.commit(transaction);
    expect(rolled).toEqual({ variables: { count: 0, name: 'Ana' }, properties: { 'name-input': 'Ana', 'result-text': 'Resultado' } });
    expect(committed).toEqual({ variables: { count: 0, name: 'Bia' }, properties: { 'name-input': 'Bia', 'result-text': 'Changed' } });
    committed.variables.name = 'Other'; expect(transaction.working.variables.name).toBe('Bia');
    rolled.variables.name = 'Other'; expect(transaction.base.variables.name).toBe('Ana');
  });
});
