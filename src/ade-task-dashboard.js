const mongodb = require("./mongodb")
const { extend, find, groupBy, keys, flatten } = require("lodash")
const moment = require("moment")

const createTaskController = require("./utils/task-controller")

// const dataView = d => ({
//     "Patient ID": d["Examination ID"],
//     "Device": d.model,
//     "Body Spot": d["Body Spot"],
//     "S3": (d.segmentation && d.segmentation.S3 && d.segmentation.S3.length > 0) ? "present" : " ",
//     "Murmurs": (
//         (d["Systolic murmurs"].filter(d => d != "No systolic murmurs").length +
//             d["Diastolic murmurs"].filter(d => d != "No diastolic murmurs").length +
//             d["Other murmurs"].filter(d => d != "No Other Murmurs").length) > 0
//     ) ? "present" : " ",
//     "Complete": d.complete
// })



const assignTasks = require("./long-term/assign-task")


const getActiveTask = async (req, res) => {
    try {

        // console.log("Events", req.eventHub)
        let { options } = req.body

        // console.log("options", options)

        if (req.eventHub.listenerCount("assign-tasks") == 0) {
            req.eventHub.on("assign-tasks", assignTasks)
        }

        options = extend(
            options, 
            req.body.cache.currentDataset,
            { userProfiles: req.body.cache.userProfiles}
        )
        // options.dataView = dataView

        const controller = createTaskController(options)

        req.eventHub.emit("assign-tasks", options)

        let taskList = await controller.selectEmployeeTask({

            matchEmployee: {
                namedAs: options.user.altname
            },

            matchVersion: {
                head: true,
                
                type: {
                    $in: ["submit", "branch", "commit", "save"]
                },

                branch:{
                    $exists: false
                },
                save:{
                    $exists: false
                },
                commit:{
                    $exists: false
                },
                submit:{
                    $exists: false
                },

                // $or: [{
                //         expiredAt: {
                //             $gte: new Date()
                //         },
                //     },
                //     {
                //         expiredAt: {
                //             $exists: false
                //         }
                //     }
                // ]
            }

        })

        res.send({
            query: req.body,
            result: taskList
        })

    } catch (e) {
        console.log(e.toString(), e.stack)
        res.send({
            error: `${e.toString()}\n${e.stack}`,
            requestBody: req.body
        })
    }
}


const getChart = data => {

    const color = {
        branch: "#FF5722",
        save: "#FF9800",
        freeze: "#689F38"
    }


    return {
        title: {
            text: `${data.started + data.inProgress + data.complete}`,
            left: "center",
            top: "62%",
            textStyle: {
                color: "#7e7e7e",
                fontSize: 18
            },
            subtextStyle: {
                fontSize: 12,
                color: "#7e7e7e",
                fontWeight: "bold"
            }

        },
        legend: {
            top: '0%',
            left: '2%',
            orient: "vertical",
            itemGap: 2,
            itemHeight: 10,
            data: ["started", "inProgress", "complete"]

        },
        "series": [{
            "type": "pie",
            "radius": [
                "30%",
                "45%"
            ],
            color: "data",
            center: [
                "50%",
                "68%"
            ],
            "itemStyle": {
                "borderRadius": 5,
                "borderColor": "#fff",
                "borderWidth": 2
            },
            "label": {
                "show": true,
                edgeDistance: 5,
                // "position": "center",
                "formatter": "{b|{c}}",
                rich: {
                    a: {
                        width: 20,
                        fontSize: 8,
                        align: 'center'
                    },
                    b: {
                        fontSize: 12,
                        color: "#7e7e7e",
                        fontWeight: 600,
                        align: 'center'
                    }
                }
            },
            emphasis: {
                label: {
                    show: true,
                    fontSize: 64,
                    fontWeight: 'bold',
                    color: "#757575"
                }
            },
            labelLine: {
                show: true
            },
            data: [{
                    name: "started",
                    value: data.started,
                    itemStyle: {
                        color: "#FF5722"
                    }
                },
                {
                    name: "inProgress",
                    value: data.inProgress,
                    itemStyle: {
                        color: "#FF9800"
                    }
                },
                {
                    name: "complete",
                    value: data.complete,
                    itemStyle: {
                        color: "#689F38"
                    }

                }
            ]
        }]
    }

}


const getEmployeeStat = async (req, res) => {
    try {

        let { options } = req.body

        options = extend(
            options, 
            req.body.cache.currentDataset,
            { userProfiles: req.body.cache.userProfiles}
        )
        
        const controller = createTaskController(options)

        let result = await controller.getEmployeeStatByTaskType({

            matchEmployee: v => v.namedAs == options.user.altname,

            matchVersion: {
                head: true,
                
                type: {
                    $in: ["submit", "branch", "commit", "save"]
                },

                branch:{
                    $exists: false
                },
                save:{
                    $exists: false
                },
                commit:{
                    $exists: false
                },
                submit:{
                    $exists: false
                },

                // $or: [{
                //         expiredAt: {
                //             $gte: new Date()
                //         },
                //     },
                //     {
                //         expiredAt: {
                //             $exists: false
                //         }
                //     }
                // ]
            }
        })

        
        if (result.length == 0) {
            return []
        }

        let stat = result[0].statistics



        let rows = stat.map(s => {

                return [{
                        "cols": [{
                            "type": "note",
                            "data": {
                                "value": s.task
                            }
                        }],
                        "decoration": {
                            "classes": "d-flex align-center subtitle-2 px-2"
                        }
                    },
                    {
                        "cols": [{
                            "type": "chart",
                            "decoration": {
                                "classes": "px-2 my-2",
                                "style": "height:200px"
                            },
                            "chart": getChart(s.totals)
                        }]
                    }
                ]


        })

    rows = flatten(rows)

    res.send(rows)

} catch (e) {
    res.send({
        error: e.toString(),
        requestBody: req.body
    })
}
}


module.exports = {
    getActiveTask,
    getEmployeeStat
}