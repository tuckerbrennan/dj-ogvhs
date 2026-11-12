import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDriveId,drivePreviewUrl,normalizeMix} from '../src/drive-mixes-model.mjs';
const id = '1AbcDEFghIJKlmnOP012345';
test('accepts only Google Drive file IDs and safe share links',()=>{
  assert.equal(parseDriveId(id),id);
  assert.equal(parseDriveId('https://drive.google.com/file/d/'+id+'/view?usp=sharing'),id);
  assert.equal(parseDriveId('https://drive.google.com/open?id='+id),id);
  for (const value of ['https://drive.google.com.evil.test/file/d/'+id+'/view','javascript:alert(1)','https://drive.google.com/drive/folders/'+id,'bad','https://example.com/file/d/'+id]) {
    assert.equal(parseDriveId(value),null);
  }
});
test('normalizes published mix metadata without interpreting HTML',()=>{
  assert.deepEqual(normalizeMix({title:'  My mix  ',description:'  The set  ',url:'https://drive.google.com/file/d/'+id+'/view'}),{title:'My mix',description:'The set',id});
  assert.equal(normalizeMix({title:'',drive_file_id:id}),null);
  assert.equal(normalizeMix({title:'My mix',drive_file_id:'javascript:alert(1)'}),null);
  assert.equal(drivePreviewUrl(id),'https://drive.google.com/file/d/'+id+'/preview');
});
