import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCatalog, filterByGenre, genreOptions } from '../src/catalog.mjs';
const tracks = [
  {id:'a',artist:'Band',title:'One',genre:'Rock; Pop'},
  {id:'b',artist:'Singer',title:'Two',genre:'Pop'},
  {id:'c',artist:'Unknown',title:'Three'},
];
test('genre options count multi-genre tracks once in each category and include unclassified',()=>{
 assert.deepEqual(genreOptions(tracks),[
  {value:'',label:'All genres',count:3},
  {value:'Pop',label:'Pop',count:2},
  {value:'Rock',label:'Rock',count:1},
  {value:'__unclassified__',label:'Unclassified',count:1},
 ]);
});
test('genre filtering combines with search and supports unclassified',()=>{
 assert.deepEqual(searchCatalog(filterByGenre(tracks,'Pop'),'Singer').map(t=>t.id),['b']);
 assert.deepEqual(filterByGenre(tracks,'__unclassified__').map(t=>t.id),['c']);
 assert.deepEqual(filterByGenre(tracks,'Jazz'),[]);
 assert.equal(filterByGenre(tracks).length,3);
});
test('genre matching is exact, case-insensitive, and happens before the result limit',()=>{
 const many=Array.from({length:70},(_,i)=>({id:String(i),artist:'Band',title:'Track '+i,genre:'Pop'}));
 many.push({id:'last',artist:'Z',title:'Last track',genre:'Rock'});
 assert.deepEqual(searchCatalog(filterByGenre(many,'rock'),'').map(t=>t.id),['last']);
 assert.equal(filterByGenre(tracks,'Roc').length,0);
});
