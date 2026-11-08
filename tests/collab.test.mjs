import test from "node:test";
import assert from "node:assert/strict";
import {spotifyPlaylistUrl,inviteFromHash,validateContribution,itunesSearchUrl,parseITunesTracks,normalizeCollabEmail,validateCollabUpload} from "../src/collab-model.mjs";

const valid="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M";
test("Spotify links are canonicalized, query removed, and non-playlist URLs rejected",()=>{
  assert.equal(spotifyPlaylistUrl(valid+"?si=abcdef"),valid);
  for(const bad of ["http://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    "https://evil.example/playlist/37i9dQZF1DXcBWIGoYBM5M",
    "https://open.spotify.com/album/37i9dQZF1DXcBWIGoYBM5M",
    "https://open.spotify.com.evil.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    "not-a-url"]) assert.equal(spotifyPlaylistUrl(bad),null);
});
test("private invite tokens are only accepted in fragment and require minimum entropy",()=>{
  const token="A".repeat(43);
  assert.equal(inviteFromHash("#invite="+token),token);
  assert.equal(inviteFromHash("#invite=short"),null);
  assert.equal(inviteFromHash(""),null);
});
test("iTunes search URLs are properly encoded and held until 3 characters",()=>{
  assert.equal(itunesSearchUrl("ab"),null);
  const url=new URL(itunesSearchUrl("Bob Marley"));
  assert.equal(url.hostname,"itunes.apple.com");
  assert.equal(url.searchParams.get("entity"),"song");
  assert.equal(url.searchParams.get("term"),"Bob Marley");
  assert.equal(url.searchParams.get("limit"),"10");
});
test("iTunes results map to external suggestions and deduplicate entries",()=>{
  const tracks=parseITunesTracks({results:[
    {kind:"song",trackId:1234,trackName:"One Love",artistName:"Bob Marley",collectionName:"Legend"},
    {kind:"song",trackId:4567,trackName:"One Love",artistName:"Bob Marley"},
    {kind:"music-video",trackId:5,trackName:"No",artistName:"No"}
  ]});
  assert.equal(tracks.length,1);
  assert.deepEqual(tracks[0],{kind:"external",title:"One Love",artist:"Bob Marley",
    externalProvider:"itunes",externalId:"1234",album:"Legend"});
});
test("validation distinguishes local catalog, external suggestion, manual and Spotify",()=>{
  const catalog=validateContribution({kind:"catalog",title:"Song",artist:"Artist",catalogId:"abc12345",name:"DJ"});
  assert.equal(catalog.catalogId,"abc12345");
  const external=validateContribution({kind:"external",title:"Song",artist:"Artist",
    externalProvider:"itunes",externalId:"12345"});
  assert.equal(external.externalProvider,"itunes");
  const manual=validateContribution({kind:"manual",title:"Unlisted",artist:"Somebody"});
  assert.equal(manual.title,"Unlisted");
  assert.equal(validateContribution({kind:"spotify_playlist",spotifyUrl:valid}).spotifyUrl,valid);
  assert.throws(()=>validateContribution({kind:"external",title:"Bad",externalProvider:"spotify",externalId:"1"}));
  assert.throws(()=>validateContribution({kind:"catalog",title:"No ID"}));
  assert.throws(()=>validateContribution({kind:"manual",title:""}));
});

test("email requests normalize case and reject invalid addresses",()=>{
  assert.equal(normalizeCollabEmail("  Foo.Bar@Example.Com  "),"foo.bar@example.com");
  assert.equal(normalizeCollabEmail("not an email"),null);
  assert.equal(normalizeCollabEmail("x@localhost"),null);
  assert.equal(normalizeCollabEmail("abc@@example.com"),null);
  assert.equal(normalizeCollabEmail("x@"+("a".repeat(255))+".com"),null);
});
test("guest upload preflight allows only approved file types up to 15 MiB",()=>{
  for(const file of ["song.mp3","mix.flac","set.m3u8","notes.txt","playlist.csv","contract.pdf"]){
    assert.equal(validateCollabUpload(file,300000),null);
  }
  for(const bad of ["script.js","archive.zip","malware.exe","no-extension","fake.mp3.exe"]){
    assert.notEqual(validateCollabUpload(bad,1234),null);
  }
  assert.notEqual(validateCollabUpload("song.mp3",0),null);
  assert.notEqual(validateCollabUpload("song.mp3",15*1024*1024+1),null);
});
