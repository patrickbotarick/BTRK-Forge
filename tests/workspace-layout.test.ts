import { describe, expect, it } from 'vitest';
import { clampSize, sideWidths } from '../apps/studio/src/workspace-layout';

describe('dimensões do workspace',()=>{
  it('limita valores acima e abaixo dos extremos',()=>{
    expect(clampSize(-10,80,360)).toBe(80);
    expect(clampSize(400,80,360)).toBe(360);
  });

  it('protege o centro em janela estreita e recupera os tamanhos pedidos em janela maior',()=>{
    const narrow=sideWidths(1000,420,460);
    expect(narrow.leftSize+narrow.rightSize+24).toBeLessThanOrEqual(680);
    expect(sideWidths(1440,420,460)).toMatchObject({leftSize:420,rightSize:460});
  });

  it('libera espaço do painel recolhido e restaura os padrões',()=>{
    expect(sideWidths(1000,0,460)).toMatchObject({leftSize:0,rightSize:460});
    expect(sideWidths(1000,220,270)).toMatchObject({leftSize:220,rightSize:270});
  });
});
