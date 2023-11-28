// const fs = require('fs')
// const fsp = fs.promises
const path = require('path')
// const { sortBy } = require("lodash")


const { loadYaml, pathExists } = require("../../../../sync-data/src/utils/file-system")
const backupConfig = loadYaml(path.join(__dirname, `../../../../sync-data/.config/data/backup.yml`))



const updateRecording = async (recording, callback) => {
    
    const controller = await require("../../../../sync-data/src/controller")({
        console,
        firebaseService: {
            noprefetch: true
        }
    })

    let res = await controller.updateRecording( recording, callback )

    return res

}


const getFileDescription = async (targetDrive,homeDir, targetDir, file) => {
    await targetDrive.load(homeDir)
    targetDrive.fileList(`${homeDir}/${targetDir}/${path.basename(fileSourcePath)}`)[0]        
}


const copyToGD = async (fileSourcePath, homeDir, targetDir, callback) => {

    const controller = await require("../../../../sync-data/src/controller")({
        console,
        firebaseService: {
            noprefetch: true
        }
    })

    try {
    
        const targetDrive = await controller.googledriveService.create({
            subject: backupConfig.subject
        })

        // await uploadToGD("./.tmp/uploads/angular.png", "TEST-UPLOADS", "images/angular.png")

        // console.log(`LOAD DIRS FOR TARGET DRIVE: ${backupConfig.location}/${homeDir}`)
        await targetDrive.load(homeDir)
        
        console.log(`\n----- COPY FILE ----- ${fileSourcePath} into GD: ${homeDir}/${targetDir}`, "\n\n")
        await targetDrive.uploadFile(fileSourcePath, `${homeDir}/${targetDir}`, callback)

        // controller.close()
        let result = targetDrive.fileList(`${homeDir}/${targetDir}/${path.basename(fileSourcePath)}`)[0]
        
        if(!result){
            console.log(`REPEAT for  -- ${homeDir}/${targetDir}/${path.basename(fileSourcePath)}`)
            result = await getFileDescription(targetDrive, homedir, targetDir, path.basename(fileSourcePath))
        }
        
        return result
    
    } catch(e) {

        // controller.close()

        return {error: e.toString()}
    
    }    
}

const getFileWriteStreamFromGD = async fileId => {

    const controller = await require("../../../../sync-data/src/controller")({
        console,
        firebaseService: {
            noprefetch: true
        }
    })


    const targetDrive = await controller.googledriveService.create({
        subject: backupConfig.subject
    })

    let stream = await targetDrive.geFiletWriteStream({ id: fileId })
    // controller.close()

    return stream

}


const createFolder = async (homeDir, dirPath) => {
    
    const controller = await require("../../../../sync-data/src/controller")({
        console,
        firebaseService: {
            noprefetch: true
        }
    })

    // console.log(homeDir, ">>" ,dirPath)

    const targetDrive = await controller.googledriveService.create({
        subject: backupConfig.subject
    })

    await targetDrive.load(homeDir)
    
    let res = await targetDrive.createFolderbyPath(homeDir, dirPath)    

    return res

}


module.exports = {
    copyToGD,
    getFileWriteStreamFromGD,
    createFolder,
    updateRecording
}