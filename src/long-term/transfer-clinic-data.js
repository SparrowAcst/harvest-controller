const {extend} = require("lodash")
const { updateAISegmentation } = require("./ai-segmentation")
const syncOneExamination = require("../../../sync-data/src/actions/sync-one-examination")



const transferClinicData = async settings => {
    console.log(`LONG-TERM: transferClinicData: started`)
    console.log(`LONG-TERM: transferClinicData: sync`)
    let result = await syncOneExamination(settings)
    console.log(`LONG-TERM: transferClinicData: update ai segmentation`)
    await updateAISegmentation(extend( {}, result, {patientId: settings.patientId}))    
    console.log(`LONG-TERM: transferClinicData: done`)
}

module.exports = {
    transferClinicData
}