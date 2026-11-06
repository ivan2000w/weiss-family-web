import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
const {GITHUB_REPOSITORY:repository,GITHUB_SHA:commit}=process.env;
if(!/^[\w.-]+\/[\w.-]+$/.test(repository||'')||!/^[a-f0-9]{40}$/.test(commit||''))throw Error('Expected GitHub repository and immutable commit');
await mkdir('_site',{recursive:true});
for(const file of ['index.html','app.js','style.css','favicon.svg','records.enc'])await copyFile(file,`_site/${file}`);
const manifest=JSON.parse(await readFile('archive.json','utf8'));
const base=`https://raw.githubusercontent.com/${repository}/${commit}/`;
for(const group of ['documents','portraits'])for(const id of Object.keys(manifest[group])){
 const file=manifest[group][id];if(!/^[a-z0-9-]+\.enc$/.test(file))throw Error('Unexpected encrypted asset path');manifest[group][id]=base+file;
}
await writeFile('_site/archive.json',JSON.stringify(manifest));
console.log(`Prepared small Pages app; ${Object.keys(manifest.portraits).length} encrypted portraits and ${Object.keys(manifest.documents).length} encrypted documents are pinned to ${commit}.`);
