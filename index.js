const router = require('express').Router()
const DBCache = require("./src/db-cache")

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
router.post("/hhe/accept-examinations/", hhe.acceptExaminations)
router.post("/hhe/reject-examinations/", hhe.rejectExaminations)


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
router.post("/hhpf/update-diagnosis/", hhpf.updateDiagnosisTags)
router.post("/hhpf/update-form/", hhpf.updateForm)
router.post("/hhpf/get-examination/", hhpf.getExamination)
router.post("/hhpf/commit-workflow-tags/", hhpf.commitWorkflowTags)



// router.get("/hhpf/get-file/:id", hhpf.getFile)
// router.get("/hhpf/file/", hhpf.getFile)
// router.get("/hhpf/file/:id", hhpf.getFile)


////////////////////////////////////////////////////////////////////////////
const hhf = require("./src/hhf")

router.post("/hhf/get-grants/", hhf.getGrants)
router.post("/hhf/get-forms/", hhf.getForms)
router.post("/hhf/get-list/", hhf.getExaminationList)

router.post("/hhf/update-forms/", hhf.updateForms)
router.post("/hhf/sync-forms/", hhf.syncExaminations)
router.post("/hhf/lock-forms/", hhf.lockForms)
router.post("/hhf/unlock-forms/", hhf.unlockForms)

router.post("/hhf/sync-assets/", hhf.syncAssets)

router.post("/hhf/get-rules/", hhf.getRules)
router.post("/hhf/submit/", hhf.postSubmitOneExamination)



////////////////////////////////////////////////////////////////////////////
const hhl = require("./src/hhl")

router.post("/hhl/get-dataset-list/", hhl.getDatasetList)
router.post("/hhl/get-grants/", hhl.getGrants)
router.post("/hhl/get-forms/", hhl.getForms)
router.post("/hhl/get-record/", hhl.getRecord)
router.post("/hhl/get-metadata/", hhl.getMetadata)
router.post("/hhl/update-record/", hhl.updateRecord)
router.post("/hhl/update-tag-record/", hhl.updateTagedRecord)

router.post("/hhl/segmentation/", hhl.updateSegmentation)
router.post("/hhl/changelog/", hhl.getChangelog)
router.post("/hhl/profile/", hhl.getProfile)



////////////////////////////////////////////////////////////////////////////

const hht = require("./src/hht")

router.post("/hht/get-tags/", hht.getTags)
router.post("/hht/update-tags/", hht.updateTags)





////////////////////////////////////////////////////////////////////////////

const report = require("./src/report")
router.post("/report/run-script/", report.runScript)
router.post("/report/run-script/:type/", report.runScript)
router.post("/report/get-metadata/", report.getMetadata)
router.post("/report/get-collections/", report.getCollections)

router.get("/report/test/", report.test)
router.post("/report/test/", report.test)

////////////////////////////////////////////////////////////////////////////

const uploader = require("./src/utils/multipart-upload/routes")

router.get("/file/fileid", uploader.getFileId)
router.get("/file/upload", uploader.getUpload)
router.post("/file/upload", uploader.postUpload)
router.post("/file/gd", uploader.postGd)
router.get("/file/gd", uploader.getGd)
router.post("/file/gd/folder", uploader.postGdCreateFolder)
router.post("/file/gd/status", uploader.postGdStatus)

router.post("/file/record/status", uploader.postUpdateRecordingStatus)
router.post("/file/record", uploader.postUpdateRecording)

router.post("/file/metadata", uploader.postGetGdFileMetadata)


/////////////////////////////////////////////////////////////////////////////////////

const uploaderS3 = require("./src/utils/multipart-upload/routes-s3")

router.get("/file-s3/fileid", uploaderS3.getFileId)
router.get("/file-s3/upload", uploaderS3.getUpload)
router.post("/file-s3/upload", uploaderS3.postUpload)
router.post("/file/s3", uploaderS3.s3Upload)
router.get("/file/s3/status", uploaderS3.s3UploadStatus)
router.post("/file/s3/status", uploaderS3.s3UploadStatus)
router.post("/file/s3/metadata", uploaderS3.s3Metadata)
router.post("/file/s3/url", uploaderS3.s3PresignedUrl)

/////////////////////////////////////////////////////////////////////////////////////

const pr = require("./src/prod-record")

router.post("/pr/get-dataset-list/", pr.getDatasetList)
router.post("/pr/get-grants/", pr.getGrants)
router.post("/pr/get-events/", pr.getRecords)
router.post("/pr/get-exams/", pr.getExams)
router.post("/pr/select-exams/", pr.selectExams)


router.post("/pr/get-tag-list/", [DBCache,pr.getTagList])
router.post("/pr/add-tags/", pr.addTags)
router.post("/pr/remove-tag/", pr.removeLastTag)


router.post("/pr/add-task/", pr.addToTask)
router.post("/pr/import/", pr.addToTask)

router.post("/pr/segment/", pr.getSegmentation)

router.post("/pr/export/", pr.exportSelection)
router.get("/pr/export/:id", pr.exportFile)
router.get("/pr/export/", pr.exportFile)
router.get("/pr/get-field-list/", pr.getFieldList)
router.post("/pr/get-field-list/", pr.getFieldList)

router.post("/pr/save-consistency/", pr.setConsistency)

router.post("/pr/add-tags-dia/", pr.addTagsDia)
router.post("/pr/remove-tag-dia/", pr.removeLastTagDia)


const adeTaskDashboard = require("./src/ade-task-dashboard") 
const adeGrants = require("./src/ade-grants") 
const adeLabeling = require("./src/ade-labeling") 
const adePatientView = require("./src/ade-patient-view")

router.post("/ade-grants/get-dataset-list/", [DBCache, adeGrants.getDatasetList])
router.post("/ade-grants/get-grants/", [DBCache, adeGrants.getGrants])
router.post("/ade-task-dashboard/get-active-task/", [DBCache, adeTaskDashboard.getActiveTask])
router.post("/ade-task-dashboard/assign-task/", [DBCache, adeTaskDashboard.executeAssignTasks])
router.post("/ade-task-dashboard/get-employee-stat/", [DBCache, adeTaskDashboard.getEmployeeStat])
router.post("/ade-task-dashboard/force-update/", [DBCache, adeTaskDashboard.forceUpdateCache])
router.post("/ade-task-dashboard/get-longterm/", [DBCache, adeTaskDashboard.getLongTermTask])

router.post("/ade-labeling/get-record/", [DBCache, adeLabeling.getRecordData])
router.post("/ade-labeling/save-record/", [DBCache, adeLabeling.saveRecordData])
router.post("/ade-labeling/reject-record/", [DBCache, adeLabeling.rejectRecordData])
router.post("/ade-labeling/submit-record/", [DBCache, adeLabeling.submitRecordData])
router.post("/ade-labeling/rollback-record/", [DBCache, adeLabeling.rollbackRecordData])
router.post("/ade-labeling/get-version-chart/", [DBCache, adeLabeling.getVersionChart])
router.post("/ade-labeling/get-metadata/", [DBCache, adeLabeling.getMetadata])
router.post("/ade-labeling/get-forms/", [DBCache, adeLabeling.getForms])
router.post("/ade-labeling/changelog/", [DBCache, adeLabeling.getChangelog])
router.post("/ade-labeling/get-records/", [DBCache, adeLabeling.getRecords])
router.post("/ade-labeling/segment/", [DBCache, adeLabeling.getSegmentation])
router.post("/ade-labeling/get-longterm/", [DBCache, adeLabeling.getLongTermTask])


router.post("/ade-patient-view/get-records/", [DBCache, adePatientView.getRecords])
router.post("/ade-patient-view/segment/", [DBCache, adePatientView.getSegmentation])
router.post("/ade-patient-view/get-metadata/", [DBCache, adePatientView.getMetadata])
router.post("/ade-patient-view/get-forms/", [DBCache, adePatientView.getForms])
router.post("/ade-patient-view/get-tags/", [DBCache, adePatientView.getTags])



const adeClinicDataManagement = require("./src/clinic-data-management") 
router.post("/cdm/get-dataset-list/", adeClinicDataManagement.getDatasetList)
router.post("/cdm/get-grants/", adeClinicDataManagement.getGrants)
router.post("/cdm/get-exams/", adeClinicDataManagement.getExams)
router.post("/cdm/get-state-chart/", adeClinicDataManagement.getStateChart)


const userGrants = require("./src/user-grants")
router.post("/user-grant", userGrants.getGrants)


const segmentationRequest = require("./src/segmentation-request")

router.post("/segmentation/open-request/", [DBCache, segmentationRequest.openRequest])
router.get("/segmentation/:requestId/close/", segmentationRequest.closeRequest)
router.post("/segmentation/:requestId/close/", segmentationRequest.closeRequest)

router.get("/segmentation/", segmentationRequest.getSegmentationData)
router.get("/segmentation/:requestId", segmentationRequest.getSegmentationData)

router.get("/segmentation/:requestId/raw", segmentationRequest.getSegmentationDataRaw)

router.post("/segmentation/", segmentationRequest.updateSegmentationData)
router.post("/segmentation/:requestId", segmentationRequest.updateSegmentationData)


let adeAdmin = require("./src/ade-admin")

router.get("/ade-admin/cache-update/", DBCache)
router.get("/ade-admin/schedule/users/reset-priority/:user", adeAdmin.resetEmployeePriority)
router.get("/ade-admin/schedule/users/change-priority/:user/:mode/:delta", adeAdmin.changeEmployeePriority)
router.get("/ade-admin/schedule/users", [ DBCache, adeAdmin.listEmployee ])
router.get("/ade-admin/schedule/users/:users", [ DBCache, adeAdmin.listEmployee ])
router.post("/ade-admin/schedule/update", [ DBCache, adeAdmin.updateEmployeeSchedule ])

router.get("/ade-admin/schedule/settings", adeAdmin.getStrategiesSettings)
router.post("/ade-admin/schedule/settings", adeAdmin.setStrategiesSettings)






module.exports = router