// Evaluate style declarations only; unrelated imports are mocked. Native Android 35 baseline.
﻿const fs=require('fs'),vm=require('vm'),ts=require(process.cwd()+'/node_modules/typescript'),path=require('path'),crypto=require('crypto');
function evaluate(file, cache=new Map()) {
 if(cache.has(file))return cache.get(file);
 const module={exports:{}}, sheets=[];
 const native={Platform:{OS:'android',Version:35},StyleSheet:{create:s=>{sheets.push(s);return s},absoluteFillObject:{position:'absolute',left:0,right:0,top:0,bottom:0}},Animated:{Value:class{},createAnimatedComponent:x=>x},Dimensions:{get:()=>({width:390,height:844})}};
 const shared=['src/constants/theme.ts','src/components/module-text-styles.ts','src/components/form-action-styles.ts','app/components/Tasks/taskFormStyles.ts','app/components/Forms/pluginFormStyles.ts'];
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:module.exports,module,require(name){
 if(name==='react-native')return native;
 if(name.endsWith('accountScope'))return { draftIdentity:()=>null,onDraftIdentityChange:()=>()=>{} };
 if(name==='react')return{forwardRef:fn=>fn,createContext:()=>({})};
 const rel=name.startsWith('@/')?name.slice(2):path.posix.normalize(path.posix.join(path.posix.dirname(file),name));const match=shared.find(x=>x.replace(/\.tsx?$/,'')===rel);if(match)return evaluate(match,cache).exports;
 return{};
 }});
 const result={exports:module.exports,styles:sheets.at(-1)};cache.set(file,result);return result;
}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])]));return value;}
const hash=s=>crypto.createHash('sha256').update(JSON.stringify(canonical(s))).digest('hex');
module.exports={evaluate,canonical,hash};
