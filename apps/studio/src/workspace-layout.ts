export function clampSize(value:number,min:number,max:number){
  return Math.min(Math.max(value,min),Math.max(min,max));
}

export function sideWidths(available:number,left:number,right:number){
  const budget=Math.max(0,available-320-2*12);
  const leftMin=left?160:0, rightMin=right?180:0;
  const leftSize=left?clampSize(left,leftMin,Math.min(420,budget-rightMin)):0;
  const rightSize=right?clampSize(right,rightMin,Math.min(460,budget-leftSize)):0;
  return {leftSize,rightSize,leftMax:Math.max(leftMin,Math.min(420,budget-rightSize)),
    rightMax:Math.max(rightMin,Math.min(460,budget-leftSize))};
}
