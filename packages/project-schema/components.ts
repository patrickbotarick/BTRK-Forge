import { z } from 'zod';
export const componentId = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/);
const color = z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.literal('transparent')]);
const dimension = z.union([z.number().int().min(0).max(2000), z.enum(['auto', 'fill'])]);
export const styleSchema = z.object({
  width: dimension, height: dimension, background: color, color,
  borderColor: color, borderWidth: z.number().int().min(0).max(12), borderRadius: z.number().int().min(0).max(64),
  fontSize: z.number().int().min(10).max(96), fontWeight: z.enum(['400','500','600','700']), textAlign: z.enum(['left','center','right'])
}).strict();
const base = { id: componentId, parentId: componentId.nullable(), style: styleSchema };
export const componentSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('Text'), props: z.object({ text: z.string().max(1000) }).strict(), events: z.object({}).strict() }).strict(),
  z.object({ ...base, type: z.literal('Button'), props: z.object({ text: z.string().max(100), disabled: z.boolean() }).strict(), events: z.object({ click: componentId.nullable() }).strict() }).strict(),
  z.object({ ...base, type: z.literal('Input'), props: z.object({ placeholder: z.string().max(100), initialValue: z.string().max(1000), inputType: z.enum(['text','email','number']), disabled: z.boolean() }).strict(), events: z.object({}).strict() }).strict(),
  z.object({ ...base, type: z.literal('Container'), props: z.object({ direction: z.enum(['column','row']), gap: z.number().int().min(0).max(128), padding: z.number().int().min(0).max(128), align: z.enum(['stretch','flex-start','center','flex-end']), justify: z.enum(['flex-start','center','flex-end','space-between']) }).strict(), events: z.object({}).strict() }).strict()
]);
export type Component = z.infer<typeof componentSchema>;
export type ComponentStyle = z.infer<typeof styleSchema>;
export const MAX_COMPONENTS = 200;
export const MAX_DEPTH = 12;
export function component(type: Component['type'], id: string, parentId: string | null = null): Component {
  const style: ComponentStyle = { width:'auto', height:'auto', background:'transparent', color:'#F0F4F6', borderColor:'#344454', borderWidth:0, borderRadius:4, fontSize:16, fontWeight:'400', textAlign:'left' };
  switch(type) {
    case 'Text': return {id,parentId,type,style,props:{text:'Texto'},events:{}};
    case 'Button': return {id,parentId,type,style:{...style,background:'#FF934F',color:'#111820'},props:{text:'Botão',disabled:false},events:{click:null}};
    case 'Input': return {id,parentId,type,style:{...style,background:'#111820',borderWidth:1},props:{placeholder:'Digite aqui',initialValue:'',inputType:'text',disabled:false},events:{}};
    case 'Container': return {id,parentId,type,style:{...style,width:'fill',background:'#1E2933'},props:{direction:'column',gap:16,padding:24,align:'stretch',justify:'flex-start'},events:{}};
  }
}
