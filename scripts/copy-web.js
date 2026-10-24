const fs=require("fs"),path=require("path");
fs.mkdirSync("www",{recursive:true});
for(const f of ["index.html","style.css"])fs.copyFileSync(f,path.join("www",f));