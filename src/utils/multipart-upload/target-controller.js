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


const copyToGD = async (fileSourcePath, homeDir, targetDir, callback) => {

    const controller = await require("../../../../sync-data/src/controller")({
        console,
        firebaseService: {
            noprefetch: true
        }
    })


    const targetDrive = await controller.googledriveService.create({
        subject: backupConfig.subject
    })

    // await uploadToGD("./.tmp/uploads/angular.png", "TEST-UPLOADS", "images/angular.png")

    // console.log(`LOAD DIRS FOR TARGET DRIVE: ${backupConfig.location}/${homeDir}`)
    await targetDrive.load(homeDir)
    // console.log(`Upload FILE: ${fileSourcePath} into GD: ADE BACKUP/${homeDir}/${targetDir}`)
    await targetDrive.uploadFile(fileSourcePath, `${homeDir}/${targetDir}`, callback)

    controller.close()

    return targetDrive.fileList(`${homeDir}/${targetDir}/${path.basename(fileSourcePath)}`)[0]

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
    controller.close()

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