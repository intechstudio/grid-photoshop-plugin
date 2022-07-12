import { action, core } from 'photoshop';

const executeAsModal = core.executeAsModal;
const batchPlay = action.batchPlay;


class UXP_LOG {
  constructor(status, details) {
    /**
     * 0 = fail
     * 1 = in-progress
     * 2 = done
     */
    this.status = status;
    this.details = details;
  }
}

export async function batchPlayInModal(actionJSON = [], batchPlayOptions = {synchronousExecution: false, dialogOptions: "silent", commandEnablement: "never"}){
  //await core.setExecutionMode({ enableErrorStacktraces: true })
  //await core.setExecutionMode({ logRejections: true })
  return await executeAsModal(async () =>{
    return await batchPlay(actionJSON, batchPlayOptions)
      .then(res => {
        return res[0];
      })
      .catch(err => err)
  })
  .then(res => {
    return res;
  })
  .catch(err => err)
}

export function uxpLog(status, details){
  const log = new UXP_LOG(status, details);
  console.log(log);
  return log;
}

export function decodeBase64(s){
  let e={},i,b=0,c,x,l=0,a,r='',w=String.fromCharCode,L=s.length;
  const A="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for(i=0;i<64;i++){e[A.charAt(i)]=i;}
  for(x=0;x<L;x++){
      c=e[s.charAt(x)];b=(b<<6)+c;l+=6;
      while(l>=8){((a=(b>>>(l-=8))&0xff)||(x<(L-2)))&&(r+=w(a));}
  }
  return r;
}