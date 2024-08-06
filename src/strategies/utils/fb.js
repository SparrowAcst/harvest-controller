const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const uuid = require("uuid").v4

const path = require("path");

const serviceAccount = require(path.join(__dirname,'../../../../sync-data/.config/key/fb/fb.key.json'));

const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: `gs://${serviceAccount.project_id}.appspot.com`
});

const bucket = getStorage(app).bucket();

const uploadFile = async (filepath, filename) => {
  
  try {
    
    let res = await bucket.upload(filepath, {
      gzip: true,
      destination: filename,
      metadata: {
        contentType: 'audio/x-wav'
      }
    })

    res = await res[0].getSignedUrl({
      action: 'read',
      expires: new Date().setFullYear(new Date().getFullYear() + 2)
    })

    return res

  } catch(e) {
    console.log('Retry');
    return uploadFile(filepath, filename);
  }

}

const saveFileFromStream = (filename, file, stream) => {
  return new Promise((resolve,reject) => {
    stream
      .pipe(bucket.file(filename).createWriteStream({
        gzip: true,
        metadata: {
          contentType: file.mimeType
        }
      }))
      .on('finish', async () => {
        
        let res = await bucket.file(filename).getSignedUrl({
          action: 'read',
          expires: new Date().setFullYear(new Date().getFullYear() + 2)
        })
        
        resolve(res)
      })  
      .on('error', err => {
        reject(err)
      })
    
  })
}  
  

const saveFile = async (filename, data) => {
  try {


    let res = await bucket.file(filename).save(data, {
      gzip: true,
      metadata: {
        contentType: 'audio/x-wav'
      }
    })

    res = await bucket.file(filename).getSignedUrl({
      action: 'read',
      expires: new Date().setFullYear(new Date().getFullYear() + 2)
    })

    return res

  } catch(e) {
    console.log(e.toString())
    console.log('Retry');
    return saveFile(filename, data);
  }

}


const downloadFile = async (srcFilename, destFilename) => {
  // console.log("download file", srcFilename, destFilename)
  const options = {
    destination: destFilename,
  };

  try {
    await bucket.file(srcFilename).download(options);
    // console.log("Done", path.resolve(destFilename))
  } catch(e) {
    console.log(e.toString())
  }  

}

const fetchFileData = async srcFileName => {
  const contents = await bucket.file(srcFileName).download();
  return contents
}



const getFileMetadata = async filename => {
  let res = []
  try {
    res = await bucket.file(filename).getMetadata()
  } catch (e){
    console.log(e.toString())
  } finally {
    return res[0]  
  }
  
}





module.exports = {
  getFileMetadata  
} 


