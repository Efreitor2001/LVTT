import {test} from 'node:test';
import assert from 'node:assert/strict';
import {snapPoint} from '../lib/game/grid';
test('square grid snaps to cell centres and gridless preserves coordinates',()=>{assert.deepEqual(snapPoint(68,97,60,'square'),{x:90,y:90});assert.deepEqual(snapPoint(68,97,60,'none'),{x:68,y:97});});
test('hex grid uses staggered centres with equal neighbour distances',()=>{const size=60,w=Math.sqrt(3)*size,a=snapPoint(w/2+2,61,size,'hex'),b=snapPoint(w+3,151,size,'hex');assert.ok(Math.abs(a.x-w/2)<.001);assert.equal(a.y,60);assert.equal(b.y,150);assert.ok(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-w)<.001);});
