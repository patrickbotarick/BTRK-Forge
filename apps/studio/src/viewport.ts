export const viewportWidths = {desktop:'100%',web:768,mobile:375} as const;
export type Viewport = keyof typeof viewportWidths;
