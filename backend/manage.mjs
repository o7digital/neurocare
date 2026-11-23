// Run inside the dedicated backend container. Never sends email automatically.
import {createApplication} from './server.mjs';
if(process.argv[2]!=='invite' || !process.argv[3]) throw new Error('Usage: node manage.mjs invite email [owner|editor]');
const role=process.argv[4] || 'editor';
if(!['owner','editor'].includes(role)) throw new Error('Invalid role');
const app=await createApplication(process.env,{disableWorker:true});
try {console.log(app.invite(process.argv[3],role));}finally{app.close();}
