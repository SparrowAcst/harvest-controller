const createController = require("./task-controller")
const { extend, first, groupBy, keys, last } = require("lodash")
const moment = require("moment")
const uuid = require("uuid").v4

let options = {
    db: {
        url: "mongodb+srv://jace:jace@jace.llb8spm.mongodb.net/?retryWrites=true&w=majority",
        name: "dj-storage"
    },

    branchesCollection: "branches",
    grantCollection: "app-grant",
    dataCollection: "TEST",

    taskQuotePeriod: [24, "hours"],

    employee: {

        "1st expert": {
            TASK_BUFFER_MIN: 10,
            TASK_BUFFER_MAX: 21,
            TASK_QUOTE: 42,
        "TASK_QUOTE_PERIOD": [24, "hours"]

            
        },

        "2nd expert": {
            TASK_BUFFER_MIN: 10,
            TASK_BUFFER_MAX: 21,
            TASK_QUOTE: 42,
        "TASK_QUOTE_PERIOD": [24, "hours"]
        },

        "CMO": {
            TASK_BUFFER_MIN: 10,
            TASK_BUFFER_MAX: 21,
            TASK_QUOTE: 42,
        "TASK_QUOTE_PERIOD": [24, "hours"]
        },

        "admin": {
            TASK_BUFFER_MIN: 10,
            TASK_BUFFER_MAX: 84,
            TASK_QUOTE: 168,
        "TASK_QUOTE_PERIOD": [24, "hours"]
        }
    },

    dataView: d => ({
    	"Patient ID": d["Examination ID"],
    	"Device": d.model,
    	"Body Spot": d["Body Spot"],
    	"S3": (d.segmentation && d.segmentation.S3 && d.segmentation.S3.length > 0) ? "present" : " ",
    	"Murmurs": (
	    		(d["Systolic murmurs"].filter( d => d != "No systolic murmurs").length + 
	    		d["Diastolic murmurs"].filter( d => d != "No diastolic murmurs").length +
	    		d["Other murmurs"].filter( d => d != "No Other Murmurs").length) > 0
	    	) ? "present" : " ",
    	"Complete": d.complete
    })



}




const initiateData = async controller => {

    let data = require("../../../../TEST-DATASET/TEST.json")

    data = data.filter(d => [
        'Apex', 'Tricuspid', 'Pulmonic', 'Aortic', 'Right Carotid', 'Erb\'s', 'Erb\'s Right'
    ].includes(d["Body Spot"]))

    data = groupBy(data.map(d => ({
        id: d.id,
        patientId: d["Examination ID"]
    })), d => d.patientId)

    data = keys(data).map(key => ({
        patientId: key,
        task: data[key].map(d => d.id)
    }))

    for (patient of data) {
        let res = await controller.initData({
            dataId: patient.task,
            metadata: {
                patientId: patient.patientId,
                task_id: uuid(),
                task_name: "Labeling",
                task_state: "initiated"
            }
        })
        console.log("INIT", patient.patientId)
    }


}



const run = async () => {

	let options = {
	    "db": {
	        "url": "mongodb+srv://jace:jace@jace.llb8spm.mongodb.net/?retryWrites=true&w=majority",
	        "name": "dj-storage",
	        "labelingCollection": "TEST",
	        "metadataCollection": "TEST-METADATA",
	        "historyCollection": "TEST-history",
	        "organizationCollection": "TEST-ORGANIZATION",
	        "grantCollection": "app-grant",
	        "formCollection": "TEST-FORM",
	        "examinationCollection": "TEST-EXAMINATION",
	        "userCollection": "TEST-ACTOR"
	    },
	    "branchesCollection": "branches",
	    "grantCollection": "app-grant",
	    "dataCollection": "TEST",
	    "quoteCollection": "task-quotes",
	    "taskQuotePeriod": [
	        24,
	        "hours"
	    ],
	    "employee": {
	        "1st expert": {
	            "TASK_BUFFER_MIN": 10,
	            "TASK_BUFFER_MAX": 21,
	            "TASK_QUOTE": 42,
	            "TASK_QUOTE_PERIOD": [
	                24,
	                "hours"
	            ]
	        },
	        "2nd expert": {
	            "TASK_BUFFER_MIN": 10,
	            "TASK_BUFFER_MAX": 21,
	            "TASK_QUOTE": 42,
	            "TASK_QUOTE_PERIOD": [
	                24,
	                "hours"
	            ]
	        },
	        "CMO": {
	            "TASK_BUFFER_MIN": 10,
	            "TASK_BUFFER_MAX": 21,
	            "TASK_QUOTE": 42,
	            "TASK_QUOTE_PERIOD": [
	                24,
	                "hours"
	            ]
	        },
	        "admin": {
	            "TASK_BUFFER_MIN": 10,
	            "TASK_BUFFER_MAX": 42,
	            "TASK_QUOTE": 84,
	            "TASK_QUOTE_PERIOD": [
	                24,
	                "hours"
	            ]
	        }
	    },
	    "medicalDocUrl": "./design/MEDICAL-DOCS-7?id=",
	    "labelingUrl": "./design/HH1L5?recordId=",
	    "recordsUrl": "./design/HH1R3?id=",
	    "availableSync": false,
	    "recordId": "d2397c7e-6351-4af2-a2a0-8b6962697109",
	    dataId: ["d2397c7e-6351-4af2-a2a0-8b6962697109"],
	    "user": {
	        "_id": "644e9b446088ff32a57ed021",
	        "email": "boldak.andrey@gmail.com",
	        "name": "Andrey Boldak",
	        "photo": "https://lh3.googleusercontent.com/a/ACg8ocLd44GXOJGf-iej_eSy2Ew9APxGbbHEAdd0gqeeEeFcU_KK-Cva=s96-c",
	        "createdAt": "2021-02-03T13:56:23.588Z",
	        "isAdmin": true,
	        "isLoggedIn": true,
	        "isOwner": true,
	        "isCollaborator": false,
	        "altname": "Andrey Boldak",
	        "profile": {
	            "name": "Total control",
	            "finalization": {
	                "rules": [
	                    null
	                ]
	            },
	            "forms": {
	                "canEditReliabilityPatient": true,
	                "canEditReliabilityEcg": true,
	                "canEditReliabilityEcho": true,
	                "canEditForms": true,
	                "canViewChangelog": true,
	                "canEditEcg": true,
	                "canEditPatient": true,
	                "canFinalizePatient": true,
	                "canEditEcho": true,
	                "canViewEcgReliability": true,
	                "canFinalizeEcg": true,
	                "canFinalizeEcho": true,
	                "canViewPatientReliability": true,
	                "canViewEchoReliability": true,
	                "canEditRecordConsistency": true,
	                "canViewPatientChangeLog": true
	            },
	            "diagnosis": {
	                "canEditDiagnosis": true,
	                "canEditClassification": true,
	                "canFinalizeDiagnosis": true,
	                "canViewDiagnosisTable": false,
	                "canViewExpertAssessments": true,
	                "canViewDiagnosisReliability": true
	            },
	            "description": "Total control for CMO"
	        },
	        "role": "admin"
	    }
	}


    let controller = createController(options)
    let brancher = await controller.getBrancher(options)

    const userHead = (dataId, user) => version => version.dataId == dataId && version.user == user && version.head == true 
	const mainHead = (dataId, user) => version => version.dataId == dataId && version.type == "main" && version.head == true 
	const getDataHead = (brancher, dataId, user) => {
		let v1 = brancher.select(userHead(dataId, user))[0]
		// console.log(v1)  
		let v2 = brancher.select(mainHead(dataId, user))[0]
		// console.log(v2)  
		
		return (v1) ? v1 : v2
	}	


	// console.log(options.dataId[0], options.user.altname)

    let head =  getDataHead( brancher, options.dataId[0], options.user.altname)
    
    head.data = (await brancher.resolveData({ version: head }))


    // await controller.selectEmployeeTask({
    // 	matchEmployee:{
    // 		namedAs: "A"//options.user.altname
    // 	},
    // 	matchVersion: {
    // 		dataId: options.recordId
    // 	}
    // })

    console.log(head)


    // await initiateData(controller)

    // await controller.startFromMain({

    //     matchVersion: {
    //         "metadata.task_state": "initiated",
    //         "metadata.task_name": "Labeling",
    //         branch: {
    //             $exists: false,
    //         }
    //     },

    //     matchEmployee: {
    //         namedAs: "Andrey Boldak"
    //     },

    //     parallel: 1,

    //     metadata: {
    //         task_state: "test started"
    //     }


    // })

    // let taskList = await controller.selectEmployeeTask({
    //     matchEmployee: {
    //         namedAs: "Andrey Boldak"
    //     },
    //     matchVersion: {
    //         head: true,
    //         readonly: false
    //     }
    // })

    // console.log('role: "1st expert"', taskList.length)

    // let taskList = await controller.selectEmployeeTask({
    // 	matchEmployee: {
    // 		namedAs: "B"
    // 	},
    // 	matchVersion:{
    // 		dataId: '416e00a0-1453-4047-99df-7e4744c53eaf'
    // 	}
    // })	

    // console.log(taskList)

    // console.log('namedAs: "B"', taskList[0].version.metadata, taskList[0].version.dataId)

    // let data = await controller.resolveData({version: taskList[0].version})

    // console.log(data)

    // data.newData = "New DATA"

    // let brancher  = await controller.getBrancher( extend({}, options, { dataId: taskList[0].version.dataId}))



    // // let save = await brancher.save({
    // // 	source: taskList[0].version,
    // // 	data
    // // })	

    // console.log(brancher.getHistory({
    // 	version: last(taskList).version,
    // 	maxDepth: 3
    // }))


    // taskList = await controller.selectEmployeeTask({
    //     matchEmployee: {
    //         namedAs: "Andrey Boldak"
    //     },
    //     matchVersion: {
    //         head: true,
    //         readonly: false
    //     }
    // })

    // console.log(taskList)

    // taskList = await controller.selectEmployeeTask({
    // 	matchVersion:{
    // 		"metadata.task_name": "Labeling"
    // 	}
    // })	

    // console.log('"metadata.task_name": "Labeling"', taskList.length)

    // taskList = await controller.selectEmployeeTask({
    // 	matchVersion:{
    // 		"metadata.patientId": "PYB0216"
    // 	}
    // })	

    // console.log('"metadata.patientId": "PYB0216"', taskList.length)

    // taskList = await controller.selectEmployeeTask({
    // 	matchVersion:{
    // 		"metadata.patientId": "PYB0205"
    // 	}
    // })	

    // console.log('"metadata.patientId": "PYB0205"', taskList.length)

    // taskList = await controller.selectEmployeeTask({
    // 	matchVersion:{
    // 		"metadata.patientId": "PYB0205-1"
    // 	}
    // })	

    // console.log('"metadata.patientId": "PYB0205-1"', taskList.length)



    // taskList = await controller.selectMainTask({
    // 	matchVersion:{
    // 		"metadata.patientId": "PYB0205"
    // 	}
    // })	

    // console.log('"metadata.patientId": "PYB0205"', taskList.length)

    // taskList = await controller.selectMainTask({
    // 	matchVersion:{
    // 		"metadata.task_name": "Labeling",
    // 		branch: {
    // 			$exists: false
    // 		}
    // 	}
    // })	

    // console.log('"metadata.patientId": "PYB0205"', taskList.length)

    // taskList = await controller.selectMainTask({})	
    // console.log('"metadata.patientId": "PYB0205"', taskList.length)


    // let priority = await controller.getEmployeeStat({

    // 	employee:{
    // 		namedAs: "Andrey Boldak"
    // 	},

    // 	version: {
    // 		createdAt:{
    // 			$gte:  moment(new Date()).subtract(...options.taskQuotePeriod).toDate()
    // 		}
    // 	}
    // })


    // console.log(JSON.stringify(priority, null, " "))





    // console.log("OPEN task FOR 1st experts")
    // console.log(( await controller.getWorkerActivity({
    // 		worker: {
    // 			role: "1st expert"
    // 		},
    // 		version: {
    // 			head: true,
    // 			readonly: false
    // 		}
    // 	})
    // ))

    // console.log("Saves for worker 'A'")
    // console.log(( await controller.getWorkerActivity({
    // 		worker: {
    // 			namedAs: "A"
    // 		},
    // 		version: {
    // 			type: "save"
    // 		}
    // 	})
    // ))


    // console.log("OPEN task FOR dataId = 5")
    // console.log(( await controller.getWorkerActivity({
    // 		version: {
    // 			head: true,
    // 			readonly: false,
    // 			dataId: 5
    // 		}
    // 	})
    // ))

    // console.log("Task FOR dataId = 5 after specific date")
    // console.log(( await controller.getWorkerActivity({
    // 		version: {
    // 			dataId: 5,
    // 			type: "save",
    // 			createdAt:{
    // 				$gte: moment(new Date("2024-06-21T16:33:37.042+00:00")).subtract(7, 'days').toDate()
    // 			}
    // 		}
    // 	})
    // ))

    // console.log("Closed task")
    // console.log(( await controller.getWorkerActivity({

    // 		// worker:{
    // 		// 	namedAs: "A"
    // 		// },

    // 		version: {
    // 			dataId: 5,
    // 			type: "save",

    // 			createdAt:{
    // 				$gte: moment(new Date("2024-06-21T16:33:37.042+00:00")).subtract(7, 'days').toDate()
    // 			},

    // 			$or:[

    // 				{
    // 					branch:{
    // 						$exists: true
    // 					}
    // 				},
    // 				{
    // 					commit:{
    // 						$exists: true
    // 					}
    // 				},
    // 				{
    // 					merge:{
    // 						$exists: true
    // 					}
    // 				}

    // 			]

    // 		}
    // 	})
    // ))


    // console.log("Open task")
    // console.log(( await controller.getWorkerActivity({

    // 		// worker:{
    // 		// 	namedAs: "A"
    // 		// },

    // 		version: {
    // 			dataId: 5,
    // 			head: true,
    // 			readonly: false,
    // 			// createdAt:{
    // 			// 	$gte: moment(new Date("2024-06-21T16:33:37.042+00:00")).toDate()
    // 			// }

    // 		}
    // 	})
    // ))


    // console.log("STAT")





    // let timeline = await controller.getTimeline({

    // 	employee:{
    // 		// role: "2nd expert"
    // 		namedAs: "A"
    // 	},

    // 	// version: {
    // 	// 	// dataId: 5,
    // 	// 	createdAt:{
    // 	// 		$gte:  moment(new Date("2024-06-21T16:33:37.042+00:00")).subtract(...TASK_QUOTE_PERIOD).toDate()
    // 	// 	}
    // 	// },

    // 	// groupBy:{
    // 	// 	employee: {
    // 	// 		name: "employee"
    // 	// 	},
    // 	// 	type: {
    // 	// 		name: "versionType"
    // 	// 	}	
    // 	// },

    // 	unit: "second",
    // 	// binSize: 7
    // })

    // // console.log(timeline)

    // const states = ['open', 'inactive', 'active', 'done', "buffer"]
    // // const states = ['buffer', 'free']

    // let acc

    // let chart = {
    // 	  tooltip: {
    // 	    trigger: 'axis',
    // 	    axisPointer: {
    // 	      type: 'cross',
    // 	      label: {
    // 	        backgroundColor: '#6a7985'
    // 	      }
    // 	    }
    // 	  },
    // 	  legend: {
    // 	    data: states
    // 	  },
    // 	  toolbox: {
    // 	    feature: {
    // 	      saveAsImage: {}
    // 	    }
    // 	  },
    // 	  grid: {
    // 	    left: '3%',
    // 	    right: '4%',
    // 	    bottom: '3%',
    // 	    containLabel: true
    // 	  },
    // 	  xAxis: [
    // 	    {
    // 	      type: 'time',
    // 	      boundaryGap: false,
    // 	      // data: timeline.map( t => t.time)
    // 	    }
    // 	  ],
    // 	  yAxis: [
    // 	    {
    // 	      type: 'value'
    // 	    }
    // 	  ],

    // 	  series: states.map( s => ({
    // 	  	  name: s,
    // 	      type: 'line',
    // 	      // stack: 'Total',
    // 	      // areaStyle: {},
    // 	      // step: "start",
    // 	      // emphasis: {
    // 	      //   focus: 'series'
    // 	      // },
    // 	      data: timeline.map( (t, i) => {
    // 	      	// acc = (i == 0) ? timeline[i].totals[s] : acc + timeline[i].totals[s]
    // 	      	// return acc
    // 	      	return [t.time, t.totals[s]]
    // 	      })
    // 	  })) 
    // 	}


    // console.log(JSON.stringify(chart, null, " "))


    // let expiredFreeze = await controller.getExpiredFreeze({
    // 	version: {
    // 		// user: "A"
    // 		"task.id": 'A-T1' 
    // 	}
    // })
    // console.log(expiredFreeze)

    // let commits = await controller.commitExpiredFreeze()
    // console.log(commits)


}



run()