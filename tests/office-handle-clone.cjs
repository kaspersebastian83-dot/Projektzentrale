// Test adapter only: native IndexedDB cannot retain methods of synthetic JS handles.
// Model native handle structured cloning with an explicit tag; production has no path fallback.
module.exports=function(){
 const put=IDBObjectStore.prototype.put,descriptor=Object.getOwnPropertyDescriptor(IDBRequest.prototype,'result');
 function map(value,encode){
  if(encode&&value instanceof window.SharedDirectoryHandle)return {__officeTestDirectory:true,rel:value.rel};
  if(!encode&&value?.__officeTestDirectory===true)return new window.SharedDirectoryHandle(value.rel);
  if(Array.isArray(value))return value.map(v=>map(v,encode));
  if(value&&Object.getPrototypeOf(value)===Object.prototype)return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,map(v,encode)]));
  return value;
 }
 IDBObjectStore.prototype.put=function(value,...args){return put.call(this,map(value,true),...args);};
 Object.defineProperty(IDBRequest.prototype,'result',{...descriptor,get(){return map(descriptor.get.call(this),false);}});
};
