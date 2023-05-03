const router = require('express').Router()

////////////////////////////////////////////////////////////////////////////
const hhe = require("./src/hhe")

router.post("/hhe/get-dataset-list/", hhe.getDatasetList)
router.post("/hhe/get-grants/", hhe.getGrants)
router.post("/hhe/get-tasks/", hhe.getTasks)
router.post("/hhe/update-tasks/", hhe.updateTasks)
router.post("/hhe/get-stat/", hhe.getStat)
router.post("/hhe/get-sync-stat/", hhe.getSyncStat)
router.post("/hhe/get-sync-examinations/", hhe.getSyncExaminations)
router.post("/hhe/get-organizations/", hhe.getOrganizations)


////////////////////////////////////////////////////////////////////////////
const hhr = require("./src/hhr")

router.post("/hhr/get-dataset-list/", hhr.getDatasetList)
router.post("/hhr/get-grants/", hhr.getGrants)
router.post("/hhr/get-stat/", hhr.getStat)
router.post("/hhr/get-events/", hhr.getEvents)
router.post("/hhr/get-team/", hhr.getTeam)
router.post("/hhr/get-forms/", hhr.getForms)
router.post("/hhr/get-available-values/", hhr.getAvailableValues)


////////////////////////////////////////////////////////////////////////////
const hhs = require("./src/hhs")

router.post("/hhs/get-dataset-list/", hhs.getDatasetList)
router.post("/hhs/get-grants/", hhs.getGrants)
router.post("/hhs/get-stat/", hhs.getStat)
router.post("/hhs/get-events/", hhs.getEvents)
router.post("/hhs/get-team/", hhs.getTeam)
router.post("/hhs/get-forms/", hhs.getForms)
router.post("/hhs/get-available-values/", hhs.getAvailableValues)



////////////////////////////////////////////////////////////////////////////
const hhpf = require("./src/hhpf")

router.post("/hhpf/get-dataset-list/", hhpf.getDatasetList)
router.post("/hhpf/get-grants/", hhpf.getGrants)
router.post("/hhpf/get-forms/", hhpf.getForms)
// router.get("/hhpf/get-file/", hhpf.getFile)
// router.get("/hhpf/get-file/:id", hhpf.getFile)
// router.get("/hhpf/file/", hhpf.getFile)
// router.get("/hhpf/file/:id", hhpf.getFile)


////////////////////////////////////////////////////////////////////////////
const hhl = require("./src/hhl")

router.post("/hhl/get-dataset-list/", hhl.getDatasetList)
router.post("/hhl/get-grants/", hhl.getGrants)
router.post("/hhl/get-forms/", hhl.getForms)
router.post("/hhl/get-record/", hhl.getRecord)
router.post("/hhl/get-metadata/", hhl.getMetadata)
router.post("/hhl/update-record/", hhl.updateRecord)
router.post("/hhl/segmentation/", hhl.updateSegmentation)


////////////////////////////////////////////////////////////////////////////

const report = require("./src/report")
router.post("/report/run-script/", report.runScript)
router.post("/report/run-script/:type/", report.runScript)
router.post("/report/get-metadata/", report.getMetadata)
router.post("/report/get-collections/", report.getCollections)

router.get("/report/test/", report.test)
router.post("/report/test/", report.test)

module.exports = router