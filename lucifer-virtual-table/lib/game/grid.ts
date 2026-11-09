export function snapPoint(x:number,y:number,size:number,grid:'square'|'hex'|'none'):{x:number;y:number}{
 if(grid==='none')return {x,y};
 if(grid==='square')return {x:Math.round((x-size/2)/size)*size+size/2,y:Math.round((y-size/2)/size)*size+size/2};
 const width=Math.sqrt(3)*size,row=Math.round((y-size)/(1.5*size));
 let best={x,y},distance=Infinity;
 for(let r=row-1;r<=row+1;r++){const offset=r%2===0?width/2:0,col=Math.round((x-offset)/width);for(let c=col-1;c<=col+1;c++){const candidate={x:c*width+offset,y:r*1.5*size+size},d=Math.hypot(candidate.x-x,candidate.y-y);if(d<distance){distance=d;best=candidate;}}}
 return best;
}
