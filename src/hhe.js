const mongodb = require("./mongodb")
const { extend, sortBy, uniq, flattenDeep, minBy } = require("lodash")
const { getPage } = require("./utils/paginate")
const { hist } = require("./utils/hist")

const getDatasetList = async (req, res) => {
	try {
		
		let options = req.body.options
		
		options = extend( {}, options, {
			collection: `${options.db.name}.dataset`,
			pipeline: [   
	            {
	                $project:{ _id: 0 }
	            }
	        ] 
		})

	
		const result = await mongodb.aggregate(options)
		res.send(result)
	
	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}	

}



const getTasks1 = async (req, res) => {
  try {

    let options = req.body.options

    // let paginationPipeline = [
    //   {
    //     $lookup:
    //       {
    //         from: options.db.labelingCollection,
    //         localField: "patientId",
    //         foreignField: "Examination ID",
    //         pipeline: [
    //           {
    //             $project: {
    //               _id: 0,
    //               "updated at": 1,
    //               update: {
    //                 at: "$updated at",
    //                 by: "$updated by",
    //               },
    //               "1st expert": 1,
    //               "2nd expert": 1,
    //             },
    //           },
    //         ],
    //         as: "r",
    //       },
    //   },
    //   {
    //     $addFields:
    //       {
    //         "updated at": {
    //           $max: "$r.updated at",
    //         },
    //         "1st expert": {
    //           $map: {
    //             input: "$r",
    //             as: "item",
    //             in: "$$item.1st expert",
    //           },
    //         },
    //         "2nd expert": {
    //           $map: {
    //             input: "$r",
    //             as: "item",
    //             in: "$$item.2nd expert",
    //           },
    //         },
    //         update: {
    //           $map: {
    //             input: "$r",
    //             as: "item",
    //             in: "$$item.update",
    //           },
    //         },
    //       },
    //   },
    //   {
    //     $addFields:
    //       {
    //         "updated by": {
    //           $arrayElemAt: [
    //             {
    //               $filter: {
    //                 input: "$update",
    //                 as: "item",
    //                 cond: {
    //                   $eq: [
    //                     "$updated at",
    //                     "$$item.at",
    //                   ],
    //                 },
    //               },
    //             },
    //             0,
    //           ],
    //         },
    //       },
    //   },
    //   {
    //     $project:
    //       {
    //         _id: 0,
    //         "Examination ID": "$patientId",
    //         "1st expert": 1,
    //         "2nd expert": 1,
    //         "updated at": 1,
    //         "updated by": "$updated by.by",
    //       },
    //   }
    // ]

    let paginationPipeline = [
      {
        $group:
          {
            _id: "$Examination ID",
            "1st expert": {
              $addToSet: "$1st expert",
            },
            "2nd expert": {
              $addToSet: "$2nd expert",
            },
            update: {
              $push: {
                by: "$updated by",
                at: {
                  $toDate: "$updated at"
                },
              },
            },
            "updated at": {
              $max: {
                $toDate: "$updated at"
              },
            },
          },
      },
      {
        $addFields:
          {
            "updated by": {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$update",
                    as: "item",
                    cond: {
                      $eq: [
                        "$updated at",
                        "$$item.at"
                      ],
                    },
                  },
                },
                0,
              ],
            },
          },
      },
      {
        $project:
          {
            _id: 0,
            "Examination ID": "$_id",
            "1st expert": 1,
            "2nd expert": 1,
            "updated at": 1,
            "updated by": "$updated by.by",
          },
      },
    ]

    let userFilter = (options.me)
      ? [
          {
              '$match': {
                '$or': [
                  {
                    'updated by': options.me
                  }, {
                    '1st expert': options.me
                  }, {
                    '2nd expert': options.me
                  }, {
                    'CMO': options.me
                  }
                ]
              }
          }    
      ]
      : []

    // console.log("---------------0------------------")  

    let data = await mongodb.aggregate(extend({}, options, {
        collection: `${options.db.name}.${options.db.labelingCollection}`,
        pipeline: paginationPipeline
              .concat(options.eventData.filter)
              .concat(userFilter)
              .concat([
                {
                  $project:{
                    "Examination ID": 1,
                    "updated at": 1
                  }  
                }
              ])
    }))

    // console.log("---------------1------------------")  
    
    let count = data.length
      
      options.eventData = extend(options.eventData, {
          total: count,
          pagePosition: `${options.eventData.skip+1} - ${Math.min(options.eventData.skip + options.eventData.limit, count)} from ${count}`
      })

    let exams = getPage(
        data, 
        options.eventData.skip, 
        options.eventData.limit,
        d => new Date(d["updated at"]),
        d => d["Examination ID"],
        "desc"
    ) 
  
    let nestedPipeline = options.excludeFilter.concat(
      [
        {
          $project: {
            _id: 0,
            "updated at": {
              $toDate: "$updated at"
            },
            update: {
              at: {
                $toDate: "$updated at"
              },
              by: "$updated by",
            },
            "Recording Informativeness": 1,
            "1st expert": 1,
            "2nd expert": 1,
            TODO: 1,
          },
        }
      ]
    )


    let mainPipeline = [
        {
          $match:
            {
              patientId: {
                $in: exams
              },
            },
        },
        {
          $lookup:
            {
              from: options.db.labelingCollection,
              localField: "patientId",
              foreignField: "Examination ID",
              pipeline: nestedPipeline,
              as: "r",
            },
        },
        {
          $addFields:
            {
              "updated at": {
                $max: "$r.updated at"
              },
              "1st expert": {
                $map: {
                  input: "$r",
                  as: "item",
                  in: "$$item.1st expert",
                },
              },
              "2nd expert": {
                $map: {
                  input: "$r",
                  as: "item",
                  in: "$$item.2nd expert",
                },
              },
              qty: {
                $map: {
                  input: "$r",
                  as: "item",
                  in: "$$item.Recording Informativeness",
                },
              },
              TODO: {
                $map: {
                  input: "$r",
                  as: "item",
                  in: "$$item.TODO",
                },
              },
              update: {
                $map: {
                  input: "$r",
                  as: "item",
                  in: "$$item.update",
                },
              },
            },
        },
        {
          $addFields:
            {
              "updated by": {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$update",
                      as: "item",
                      cond: {
                        $eq: [
                          "$updated at",
                          "$$item.at"
                        ],
                      },
                    },
                  },
                  0,
                ],
              },
            },
        },
        {
          $lookup:
            {
              from: options.db.formCollection,
              localField: "id",
              foreignField: "examinationId",
              pipeline: [
                {
                  $match: {
                    type: "patient",
                  },
                },
                {
                  $project: {
                    _id: 0,
                    dia: "$data.en.diagnosisTags",
                  },
                },
              ],
              as: "dia",
            },
        },
        {
          $project:
            {
              _id: 0,
              id: 1,
              state: 1,
              "Examination ID": "$patientId",
              qty: 1,
              TODO: 1,
              "1st expert": 1,
              "2nd expert": 1,
              "updated at": 1,
              "updated by": "$updated by.by",
              dia: {
                $arrayElemAt: ["$dia.dia", 0],
              },
            },
        },
        {
          $sort:{
            "updated at": -1
          }
        }
      ]

  // console.log(JSON.stringify(mainPipeline, null, ' '))


  ////////////////////////////////////////////////////////////////////////

    const ddata = await mongodb.aggregate(extend({}, options, {
      collection: `${options.db.name}.${options.db.examinationCollection}`,
      pipeline: mainPipeline 
    })) 

// console.log("---------------------3---------------------------")
// console.log(ddata.length)

    const result = {
        options,
        collection: ddata.map( d => {
            
            d.Recordings = d["1st expert"].length

            d["1st expert"] = sortBy(uniq(flattenDeep(d["1st expert"]))).filter( d => d)
            d["2nd expert"] = sortBy(uniq(flattenDeep(d["2nd expert"]))).filter( d => d)
            d["CMO"] = sortBy(uniq(flattenDeep(d["CMO"]))).filter( d => d)
            
            d.stat = {
              stat: hist(d.TODO, d => d, "TODO", "count"),
              total: d.TODO.length 
            }

            d.qty =   {
              hist: hist(d.qty, d => d, "value", "count"),
              total: d.qty.length 
            }

            return d
        })
    }

      res.send(result)

  } catch (e) {
    res.send({ 
      error: e.toString(),
      requestBody: req.body
    })
  }
}



const getTasks = async (req, res) => {
	try {

		let options = req.body.options

		options.pipeline = [
  {
    $group: {
      _id: {
        "Examination ID": "$Examination ID",
        TODO: "$TODO",
        "Recording Informativeness":
          "$Recording Informativeness",
      },
      count: {
        $count: {},
      },
      "1st expert": {
        $addToSet: "$1st expert",
      },
      "2nd expert": {
        $addToSet: "$2nd expert",
      },
      CMO: {
        $addToSet: "$CMO",
      },
      // informativeness:{
      //   $push: "$Recording Informativeness"
      // },
      updates: {
        $push: {
          "updated at": "$updated at",
          "updated by": "$updated by",
        },
      },
    },
  },
  {
    $project: {
      "Examination ID": "$_id.Examination ID",
      TODO: "$_id.TODO",
      "Recording Informativeness":
        "$_id.Recording Informativeness",
      count: 1,
      "1st expert": 1,
      "2nd expert": 1,
      CMO: 1,
      updates: 1,
      maxDate: {
        $max: "$updates.updated at",
      },
    },
  },
  {
    $project: {
      "Examination ID": 1,
      TODO: 1,
      "Recording Informativeness": 1,
      count: 1,
      "1st expert": 1,
      "2nd expert": 1,
      CMO: 1,
      update: {
        $arrayElemAt: [
          {
            $filter: {
              input: "$updates",
              as: "item",
              cond: {
                $eq: [
                  "$maxDate",
                  "$$item.updated at",
                ],
              },
            },
          },
          0,
        ],
      },
    },
  },
  {
    $group: {
      _id: {
        "Examination ID": "$Examination ID",
      },
      stat: {
        $addToSet: {
          TODO: "$TODO",
          count: "$count",
        },
      },
      informativeness: {
        $addToSet: {
          value: "$Recording Informativeness",
          count: "$count",
        },
      },
      "1st expert": {
        $addToSet: "$1st expert",
      },
      "2nd expert": {
        $addToSet: "$2nd expert",
      },
      CMO: {
        $addToSet: "$CMO",
      },
      updates: {
        $addToSet: "$update",
      },
    },
  },
  {
    $project: {
      "Examination ID": "$_id.Examination ID",
      stat: 1,
      informativeness: 1,
      "1st expert": {
        $reduce: {
          input: "$1st expert",
          initialValue: [],
          in: {
            $setUnion: ["$$value", "$$this"],
          },
        },
      },
      "2nd expert": {
        $reduce: {
          input: "$2nd expert",
          initialValue: [],
          in: {
            $setUnion: ["$$value", "$$this"],
          },
        },
      },
      CMO: {
        $reduce: {
          input: "$CMO",
          initialValue: [],
          in: {
            $setUnion: ["$$value", "$$this"],
          },
        },
      },
      _id: 0,
      updates: 1,
      maxDate: {
        $max: "$updates.updated at",
      },
    },
  },
  {
    $project: {
      "Examination ID": 1,
      stat: 1,
      informativeness: 1,
      "1st expert": 1,
      "2nd expert": 1,
      CMO: 1,
      update: {
        $arrayElemAt: [
          {
            $filter: {
              input: "$updates",
              as: "item",
              cond: {
                $eq: [
                  "$maxDate",
                  "$$item.updated at",
                ],
              },
            },
          },
          0,
        ],
      },
    },
  },
  {
    $project: {
      "Examination ID": 1,
      stat: 1,
      informativeness: 1,
      "1st expert": 1,
      "2nd expert": 1,
      CMO: 1,
      "updated at": "$update.updated at",
      "updated by": "$update.updated by",
    },
  },
  {
    $lookup: {
      from: options.db.examinationCollection, //"yoda-exams",
      localField: "Examination ID",
      foreignField: "patientId",
      as: "examinationState",
    },
  },
  {
    $lookup:
      /**
       * from: The target collection.
       * localField: The local join field.
       * foreignField: The target join field.
       * as: The name for the results.
       * pipeline: Optional pipeline to run on the foreign collection.
       * let: Optional variables to use in the pipeline field stages.
       */
      {
        from: options.db.formCollection, //"yoda-forms",
        localField: "examinationState.0.id",
        foreignField: "examinationId",
        as: "forms",
      },
  },
  {
    $project: {
      "Examination ID": 1,
      state: {
        $first: "$examinationState.state",
      },
      forms: {
        $filter: {
          input: "$forms",
          as: "form",
          cond: {
            $eq: ["$$form.type", "patient"],
          },
        },
      },
      stat: 1,
      qty: {
        hist: "$informativeness",
        total: {
          $sum: "$stat.count",
        },
      },
      "1st expert": 1,
      "2nd expert": 1,
      CMO: 1,
      _id: 0,
      "updated at": 1,
      "updated by": 1,
    },
  },
  {
    $addFields:
      /**
       * newField: The new field name.
       * expression: The new field expression.
       */
      {
        dia: {
          $first: "$forms.data.en.diagnosisTags",
        },
      },
  },
  // {
  //   $match:
  //     /**
  //      * query: The query in MQL.
  //      */
  //     {
  //       diagnosisTags: {
  //         $exists: true,
  //       },
  //     },
  // }
  {
    $sort: {
      "updated at": -1,
    },
  },
]



// [
//   // {
//   //   $match:
//   //     /**
//   //      * query: The query in MQL.
//   //      */
//   //     {
//   //       "Recording Informativeness": {
//   //         $exists: true,
//   //       },
//   //     },
//   // },
//   {
//     $group: {
//       _id: {
//         "Examination ID": "$Examination ID",
//         TODO: "$TODO",
//         "Recording Informativeness":
//           "$Recording Informativeness",
//       },
//       count: {
//         $count: {},
//       },
//       "1st expert": {
//         $addToSet: "$1st expert",
//       },
//       "2nd expert": {
//         $addToSet: "$2nd expert",
//       },
//       CMO: {
//         $addToSet: "$CMO",
//       },
//       // informativeness:{
//       //   $push: "$Recording Informativeness"
//       // },
//       updates: {
//         $push: {
//           "updated at": "$updated at",
//           "updated by": "$updated by",
//         },
//       },
//     },
//   },
//   {
//     $project: {
//       "Examination ID": "$_id.Examination ID",
//       TODO: "$_id.TODO",
//       "Recording Informativeness":
//         "$_id.Recording Informativeness",
//       count: 1,
//       "1st expert": 1,
//       "2nd expert": 1,
//       CMO: 1,
//       updates: 1,
//       maxDate: {
//         $max: "$updates.updated at",
//       },
//     },
//   },
//   {
//     $project: {
//       "Examination ID": 1,
//       TODO: 1,
//       "Recording Informativeness": 1,
//       count: 1,
//       "1st expert": 1,
//       "2nd expert": 1,
//       CMO: 1,
//       update: {
//         $arrayElemAt: [
//           {
//             $filter: {
//               input: "$updates",
//               as: "item",
//               cond: {
//                 $eq: [
//                   "$maxDate",
//                   "$$item.updated at",
//                 ],
//               },
//             },
//           },
//           0,
//         ],
//       },
//     },
//   },
//   {
//     $group: {
//       _id: {
//         "Examination ID": "$Examination ID",
//       },
//       stat: {
//         $addToSet: {
//           TODO: "$TODO",
//           count: "$count",
//         },
//       },
//       informativeness: {
//         $addToSet: {
//           value: "$Recording Informativeness",
//           count: "$count",
//         },
//       },
//       "1st expert": {
//         $addToSet: "$1st expert",
//       },
//       "2nd expert": {
//         $addToSet: "$2nd expert",
//       },
//       CMO: {
//         $addToSet: "$CMO",
//       },
//       updates: {
//         $addToSet: "$update",
//       },
//     },
//   },
//   {
//     $project: {
//       "Examination ID": "$_id.Examination ID",
//       stat: 1,
//       informativeness: 1,
//       "1st expert": {
//         $reduce: {
//           input: "$1st expert",
//           initialValue: [],
//           in: {
//             $setUnion: ["$$value", "$$this"],
//           },
//         },
//       },
//       "2nd expert": {
//         $reduce: {
//           input: "$2nd expert",
//           initialValue: [],
//           in: {
//             $setUnion: ["$$value", "$$this"],
//           },
//         },
//       },
//       CMO: {
//         $reduce: {
//           input: "$CMO",
//           initialValue: [],
//           in: {
//             $setUnion: ["$$value", "$$this"],
//           },
//         },
//       },
//       _id: 0,
//       updates: 1,
//       maxDate: {
//         $max: "$updates.updated at",
//       },
//     },
//   },
//   {
//     $project: {
//       "Examination ID": 1,
//       stat: 1,
//       informativeness: 1,
//       "1st expert": 1,
//       "2nd expert": 1,
//       CMO: 1,
//       update: {
//         $arrayElemAt: [
//           {
//             $filter: {
//               input: "$updates",
//               as: "item",
//               cond: {
//                 $eq: [
//                   "$maxDate",
//                   "$$item.updated at",
//                 ],
//               },
//             },
//           },
//           0,
//         ],
//       },
//     },
//   },
//   {
//     $project: {
//       "Examination ID": 1,
//       stat: 1,
//       informativeness: 1,
//       "1st expert": 1,
//       "2nd expert": 1,
//       CMO: 1,
//       "updated at": "$update.updated at",
//       "updated by": "$update.updated by",
//     },
//   },
//   {
//     $lookup: {
//       from: options.db.examinationCollection,
//       localField: "Examination ID",
//       foreignField: "patientId",
//       as: "examinationState",
//     },
//   },
//   {
//     $project: {
//       "Examination ID": 1,
//       state: {
//         $first: "$examinationState.state",
//       },
//       stat: 1,
      
//       "qty": {
// 	    hist: "$informativeness",
// 	  	total:{
// 	    	$sum: "$stat.count"
// 	  	}  
// 	  },

//       "1st expert": 1,
//       "2nd expert": 1,
//       CMO: 1,
//       _id: 0,
//       "updated at": 1,
//       "updated by": 1,
//     },
//   },
//   {
//     $sort: {
//       "updated at": -1,
//     },
//   },
// ]

		
		// options.pipeline = [
		// 	  {
		// 	    '$group': {
		// 	      '_id': {
		// 	        'Examination ID': '$Examination ID', 
		// 	        'TODO': '$TODO'
		// 	      }, 
		// 	      'count': {
		// 	        '$count': {}
		// 	      }, 
		// 	      '1st expert': {
		// 	        '$addToSet': '$1st expert'
		// 	      }, 
		// 	      '2nd expert': {
		// 	        '$addToSet': '$2nd expert'
		// 	      }, 
		// 	      'CMO': {
		// 	        '$addToSet': '$CMO'
		// 	      }, 
		// 	      'updates': {
		// 	        '$push': {
		// 	          'updated at': '$updated at', 
		// 	          'updated by': '$updated by'
		// 	        }
		// 	      }
		// 	    }
		// 	  }, {
		// 	    '$project': {
		// 	      'Examination ID': '$_id.Examination ID', 
		// 	      'TODO': '$_id.TODO', 
		// 	      'count': 1, 
		// 	      '1st expert': 1, 
		// 	      '2nd expert': 1, 
		// 	      'CMO': 1, 
		// 	      'updates': 1, 
		// 	      'maxDate': {
		// 	        '$max': '$updates.updated at'
		// 	      }
		// 	    }
		// 	  }, {
		// 	    '$project': {
		// 	      'Examination ID': 1, 
		// 	      'TODO': 1, 
		// 	      'count': 1, 
		// 	      '1st expert': 1, 
		// 	      '2nd expert': 1, 
		// 	      'CMO': 1, 
		// 	      'update': {
		// 	        '$arrayElemAt': [
		// 	          {
		// 	            '$filter': {
		// 	              'input': '$updates', 
		// 	              'as': 'item', 
		// 	              'cond': {
		// 	                '$eq': [
		// 	                  '$maxDate', '$$item.updated at'
		// 	                ]
		// 	              }
		// 	            }
		// 	          }, 0
		// 	        ]
		// 	      }
		// 	    }
		// 	  }, {
		// 	    '$group': {
		// 	      '_id': {
		// 	        'Examination ID': '$Examination ID'
		// 	      }, 
		// 	      'stat': {
		// 	        '$addToSet': {
		// 	          'TODO': '$TODO', 
		// 	          'count': '$count'
		// 	        }
		// 	      }, 
		// 	      '1st expert': {
		// 	        '$addToSet': '$1st expert'
		// 	      }, 
		// 	      '2nd expert': {
		// 	        '$addToSet': '$2nd expert'
		// 	      }, 
		// 	      'CMO': {
		// 	        '$addToSet': '$CMO'
		// 	      }, 
		// 	      'updates': {
		// 	        '$addToSet': '$update'
		// 	      }
		// 	    }
		// 	  }, {
		// 	    '$project': {
		// 	      'Examination ID': '$_id.Examination ID', 
		// 	      'stat': 1, 
		// 	      '1st expert': {
		// 	        '$reduce': {
		// 	          'input': '$1st expert', 
		// 	          'initialValue': [], 
		// 	          'in': {
		// 	            '$setUnion': [
		// 	              '$$value', '$$this'
		// 	            ]
		// 	          }
		// 	        }
		// 	      }, 
		// 	      '2nd expert': {
		// 	        '$reduce': {
		// 	          'input': '$2nd expert', 
		// 	          'initialValue': [], 
		// 	          'in': {
		// 	            '$setUnion': [
		// 	              '$$value', '$$this'
		// 	            ]
		// 	          }
		// 	        }
		// 	      }, 
		// 	      'CMO': {
		// 	        '$reduce': {
		// 	          'input': '$CMO', 
		// 	          'initialValue': [], 
		// 	          'in': {
		// 	            '$setUnion': [
		// 	              '$$value', '$$this'
		// 	            ]
		// 	          }
		// 	        }
		// 	      }, 
		// 	      '_id': 0, 
		// 	      'updates': 1, 
		// 	      'maxDate': {
		// 	        '$max': '$updates.updated at'
		// 	      }
		// 	    }
		// 	  }, {
		// 	    '$project': {
		// 	      'Examination ID': 1, 
		// 	      'stat': 1, 
		// 	      '1st expert': 1, 
		// 	      '2nd expert': 1, 
		// 	      'CMO': 1, 
		// 	      'update': {
		// 	        '$arrayElemAt': [
		// 	          {
		// 	            '$filter': {
		// 	              'input': '$updates', 
		// 	              'as': 'item', 
		// 	              'cond': {
		// 	                '$eq': [
		// 	                  '$maxDate', '$$item.updated at'
		// 	                ]
		// 	              }
		// 	            }
		// 	          }, 0
		// 	        ]
		// 	      }
		// 	    }
		// 	  }, {
		// 	    '$project': {
		// 	      'Examination ID': 1, 
		// 	      'stat': 1, 
		// 	      '1st expert': 1, 
		// 	      '2nd expert': 1, 
		// 	      'CMO': 1, 
		// 	      'updated at': '$update.updated at', 
		// 	      'updated by': '$update.updated by'
		// 	    }
		// 	  }, {
		// 	    '$lookup': {
		// 	      'from': options.db.examinationCollection, 
		// 	      'localField': 'Examination ID', 
		// 	      'foreignField': 'patientId', 
		// 	      'as': 'examinationState'
		// 	    }
		// 	  }, {
		// 	    '$project': {
		// 	      'Examination ID': 1, 
		// 	      'state': {
		// 	        '$first': '$examinationState.state'
		// 	      }, 
		// 	      'stat': 1, 
		// 	      '1st expert': 1, 
		// 	      '2nd expert': 1, 
		// 	      'CMO': 1, 
		// 	      '_id': 0, 
		// 	      'updated at': 1, 
		// 	      'updated by': 1
		// 	    }
		// 	  }, 
		// 	  {
		// 	    '$sort': 
		// 	    	(options.latest)
		// 	    		? 	{
		// 	    				"updated at": -1
		// 	    			}
		// 	    		:	
		// 				    {
		// 				      'Examination ID': 1
		// 				    }
		// 	  },
		// 	]	



				// options.pipeline = [
				// 	  {
				// 	    '$sort': 
				// 	    	(options.latest)
				// 	    		? 	{
				// 	    				"updated at": -1
				// 	    			}
				// 	    		:	
				// 				    {
				// 				      'Examination ID': 1
				// 				    }
				// 	  }, 
				// 	  {
				// 	    '$group': {
				// 	      '_id': {
				// 	        'Examination ID': '$Examination ID', 
				// 	        'TODO': '$TODO'
				// 	      }, 
				// 	      'count': {
				// 	        '$count': {}
				// 	      }, 
				// 	      '1st expert': {
				// 	        '$addToSet': '$1st expert'
				// 	      }, 
				// 	      '2nd expert': {
				// 	        '$addToSet': '$2nd expert'
				// 	      }, 
				// 	      'CMO': {
				// 	        '$addToSet': '$CMO'
				// 	      }, 
				// 	      'updates': {
				// 	        '$push': {
				// 	          'updated at': '$updated at', 
				// 	          'updated by': '$updated by'
				// 	        }
				// 	      }
				// 	    }
				// 	  }, {
				// 	    '$project': {
				// 	      'Examination ID': '$_id.Examination ID', 
				// 	      'TODO': '$_id.TODO', 
				// 	      'count': 1, 
				// 	      '1st expert': 1, 
				// 	      '2nd expert': 1, 
				// 	      'CMO': 1, 
				// 	      'updates': 1
				// 	    }
				// 	  }, {
				// 	    '$group': {
				// 	      '_id': {
				// 	        'Examination ID': '$Examination ID'
				// 	      }, 
				// 	      'stat': {
				// 	        '$addToSet': {
				// 	          'TODO': '$TODO', 
				// 	          'count': '$count'
				// 	        }
				// 	      }, 
				// 	      '1st expert': {
				// 	        '$addToSet': '$1st expert'
				// 	      }, 
				// 	      '2nd expert': {
				// 	        '$addToSet': '$2nd expert'
				// 	      }, 
				// 	      'CMO': {
				// 	        '$addToSet': '$CMO'
				// 	      }, 
				// 	      'updates': {
				// 	        '$addToSet': '$updates'
				// 	      }
				// 	    }
				// 	  }, {
				// 	    '$project': {
				// 	      'Examination ID': '$_id.Examination ID', 
				// 	      'stat': 1, 
				// 	      '1st expert': {
				// 	        '$reduce': {
				// 	          'input': '$1st expert', 
				// 	          'initialValue': [], 
				// 	          'in': {
				// 	            '$setUnion': [
				// 	              '$$value', '$$this'
				// 	            ]
				// 	          }
				// 	        }
				// 	      }, 
				// 	      '2nd expert': {
				// 	        '$reduce': {
				// 	          'input': '$2nd expert', 
				// 	          'initialValue': [], 
				// 	          'in': {
				// 	            '$setUnion': [
				// 	              '$$value', '$$this'
				// 	            ]
				// 	          }
				// 	        }
				// 	      }, 
				// 	      'CMO': {
				// 	        '$reduce': {
				// 	          'input': '$CMO', 
				// 	          'initialValue': [], 
				// 	          'in': {
				// 	            '$setUnion': [
				// 	              '$$value', '$$this'
				// 	            ]
				// 	          }
				// 	        }
				// 	      }, 
				// 	      '_id': 0, 
				// 	      'updates': {
				// 	        '$arrayElemAt': [
				// 	          '$updates', 0
				// 	        ]
				// 	      }
				// 	    }
				// 	  }, {
				// 	    '$lookup': {
				// 	      'from': options.db.examinationCollection, 
				// 	      'localField': 'Examination ID', 
				// 	      'foreignField': 'patientId', 
				// 	      'as': 'examinationState'
				// 	    }
				// 	  }, {
				// 	    '$project': {
				// 	      'Examination ID': 1, 
				// 	      'state': {
				// 	        '$first': '$examinationState.state'
				// 	      }, 
				// 	      'stat': 1, 
				// 	      '1st expert': 1, 
				// 	      '2nd expert': 1, 
				// 	      'CMO': 1, 
				// 	      '_id': 0, 
				// 	      'updates': 1
				// 	    }
				// 	  }, 
				// 	  // {
				// 	  //   '$sort': 	(options.latest)
				// 	  //   		? 	{
				// 	  //   				"updated at": -1
				// 	  //   			}
				// 	  //   		:	
				// 			// 	    {
				// 			// 	      'Examination ID': 1
				// 			// 	    }
				// 	  // }
				// 	]



		options.userFilter = (options.me)
        ? [
            {
                '$match': {
                  '$or': [
                    {
                      'updated by': options.me
                    }, {
                      '1st expert': options.me
                    }, {
                      '2nd expert': options.me
                    }, {
                      'CMO': options.me
                    }
                  ]
                }
            }    
        ]
        : []

        options.pageFilter = [
	        {
	            '$skip': options.eventData.skip
	        }, {
	            '$limit': options.eventData.limit
	        }
	    ]    
        
	    options.countPipeline = [
	        { $count: 'count'},
	        { $project: {_id: 0} }
	    ]

	    let count  = await mongodb.aggregate(extend({}, options, {
	    	collection: `${options.db.name}.${options.db.labelingCollection}`,
	    	pipeline: 	options.excludeFilter
	    				.concat(options.eventData.filter)
		                .concat(options.userFilter)
		                .concat(options.pipeline)
		                .concat(options.countPipeline)
	    }))
   
	    count = (count[0]) ? count[0].count : 0
    	
    	options.eventData = extend(options.eventData, {
        	total: count,
        	pagePosition: `${options.eventData.skip+1} - ${Math.min(options.eventData.skip + options.eventData.limit, count)} from ${count}`
    	})

    	const data = await mongodb.aggregate(extend({}, options, {
    		collection: `${options.db.name}.${options.db.labelingCollection}`,
	    	pipeline: options.excludeFilter
	    				.concat(options.eventData.filter)
		                .concat(options.userFilter)
		                .concat(options.pipeline)
		                .concat(options.pageFilter) 
    	}))	

    	const result = {
        	options,
        	collection: data.map( d => {
	            d["1st expert"] = sortBy(uniq(flattenDeep(d["1st expert"]))).filter( d => d)
	            d["2nd expert"] = sortBy(uniq(flattenDeep(d["2nd expert"]))).filter( d => d)
	            d["CMO"] = sortBy(uniq(flattenDeep(d["CMO"]))).filter( d => d)
	            d.Recordings = d.stat.map(d => d.count).reduce((a,s) => a+s, 0)
	            d.stat = {
	                stat: d.stat,
	                total: d.Recordings
	            }

	            d = extend(d, minBy(d.updates, d => d["updated at"]))
	            delete d.updates
	            return d
	        })
    	}

    	res.send(result)

	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}


const getGrants = async (req, res) => {
	try {
		
		let options = req.body.options

		options = extend( {}, options, {
			collection: `${options.db.name}.${options.db.grantCollection}`,
			pipeline: [   
	            {
	                $project:{ _id: 0 }
	            }
	        ] 
		})

	
		const result = await mongodb.aggregate(options)
		res.send(result)

	}

	 catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}



const getOrganizations = async (req, res) => {
	try {
		
		let options = req.body.options

		options = extend( {}, options, {
			collection: `${options.db.name}.${options.db.organizationCollection}`,
			pipeline: [   
	            {
	                $project:{ _id: 0 }
	            }
	        ] 
		})

		const result = await mongodb.aggregate(options)
		res.send(result)

	}

	 catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}



const getStat = async (req, res) => {
	try {
		
		let options = req.body.options



		options.pipeline = [
	        {
	            '$facet': {
	              'total': [
	                {
	                  '$count': 'count'
	                }
	              ], 
	              'examinations': [
	                {
	                  '$group': {
	                    '_id': {
	                      'Examination ID': '$Examination ID'
	                    }, 
	                    'ids': {
	                      '$addToSet': {}
	                    }
	                  }
	                }, {
	                  '$project': {
	                    'count': {
	                      '$size': '$ids'
	                    }, 
	                    '_id': 0
	                  }
	                }
	              ], 
	              'stat': [
	                {
	                  '$group': {
	                    '_id': {
	                      'TODO': '$TODO'
	                    }, 
	                    'count': {
	                      '$count': {}
	                    }
	                  }
	                }, {
	                  '$project': {
	                    'TODO': '$_id.TODO', 
	                    'count': 1, 
	                    '_id': 0
	                  }
	                }
	              ]
	            }
	          }, {
	            '$project': {
	              'total': {
	                '$first': '$total'
	              }, 
	              'stat': 1, 
	              'examinations': {
	                '$size': '$examinations'
	              }
	            }
	          }, {
	            '$project': {
	              'total': '$total.count', 
	              'stat': 1, 
	              'examinations': 1
	            }
	          }
	    ]
    
    	options.userFilter = (options.me)
	        ? [
	            {
	                '$match': {
	                  '$or': [
	                    {
	                      'updated by': options.me
	                    }, {
	                      '1st expert': options.me
	                    }, {
	                      '2nd expert': options.me
	                    }, {
	                      'CMO': options.me
	                    }
	                  ]
	                }
	            }    
	        ]
	        : []

		options = extend( {}, options, {
			collection: `${options.db.name}.${options.db.labelingCollection}`,
			pipeline: options.excludeFilter
	    				.concat(options.eventData.filter)
		                .concat(options.userFilter)
			            .concat(options.pipeline)
		})

		const result  = await mongodb.aggregate(options)

		res.send(result[0])	
	
	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}


const getSyncStat = async (req, res) => {
	try {
		
		let options = req.body.options

		options.preparePipeline =
	        [
	          {
	            '$lookup': {
	              'from': options.db.userCollection, 
	              'localField': 'actorId', 
	              'foreignField': 'id', 
	              'as': 'physician'
	            }
	          }, {
	            '$lookup': {
	              'from': options.db.organizationCollection, 
	              'localField': 'organization', 
	              'foreignField': 'id', 
	              'as': 'organization'
	            }
	          }, {
	            '$project': {
	              '_id': 0, 
	              'Examination ID': '$patientId', 
	              'organization': {
	                '$arrayElemAt': [
	                  '$organization', 0
	                ]
	              }, 
	              'physician': {
	                '$arrayElemAt': [
	                  '$physician', 0
	                ]
	              }, 
	              "updatedAt":"$updatedAt",
	              "synchronizedAt":"$synchronizedAt",
	              'state': '$state', 
	              'validation': '$_validation'
	            }
	          }, {
	              $sort:{
	                  updatedAt: -1,
	                  organization: 1,
	                  state: 1
	              }
	          }
	        ]
    	
    	options.pipeline = 
	        [
	          {
	            '$group': {
	              '_id': '$state', 
	              'count': {
	                '$count': {}
	              }
	            }
	          }, {
	            '$project': {
	              '_id': 0, 
	              'state': '$_id', 
	              'count': '$count'
	            }
	          }
	        ]

		options = extend( {}, options, {
			collection: `${options.db.name}.${options.db.examinationCollection}`,
			pipeline: options.preparePipeline
			            .concat(options.syncFilter)
			            .concat(options.pipeline)
		})
		
		let result  = await mongodb.aggregate(options)
		
		result = {
	        total: result.map( d => d.count).reduce((s,d) => s+d,0),
	        stat: result,
	        options: options
	    }

	    res.send(result)

	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}


const getSyncExaminations = async (req, res) => {
	try {
		
		let options = req.body.options
		
		options.pipeline = 
        	[
			  {
			    '$lookup': {
			      'from': options.db.userCollection, 
			      'localField': 'actorId', 
			      'foreignField': 'id', 
			      'as': 'physician'
			    }
			  }, {
			    '$lookup': {
			      'from': options.db.organizationCollection, 
			      'localField': 'organization', 
			      'foreignField': 'id', 
			      'as': 'organization'
			    }
			  }, {
			    '$project': {
			      '_id': 0, 
			      'Examination ID': '$patientId', 
			      'organization': {
			        '$arrayElemAt': [
			          '$organization', 0
			        ]
			      }, 
			      'physician': {
			        '$arrayElemAt': [
			          '$physician', 0
			        ]
			      }, 
			      "updatedAt":"$updatedAt",
			      "synchronizedAt":"$synchronizedAt",
			      'state': '$state', 
			      'validation': '$_validation',
			    }
			  }, {
			      $sort:{
			          updatedAt: -1,
			          organization: 1,
			          state: 1
			      }
			  }
			]
 
    
    	options.filter = []
        
    	options.pageFilter = [
	        {
	            '$skip': options.eventData.skip
	        }, {
	            '$limit': options.eventData.limit
	        }
	    ]    
    
    
	    options.countPipeline = [
	        { $count: 'count'},
	        { $project: {_id: 0} }
	    ]

	    let count = await mongodb.aggregate({
	    	db: options.db,
	    	collection: `${options.db.name}.${options.db.examinationCollection}`,
	    	pipeline: options.pipeline
                		.concat(options.syncFilter)
                		.concat(options.countPipeline)
	    })

	    count = (count[0]) ? count[0].count : 0
    	options.eventData = extend(options.eventData, {
	        total: count,
	        pagePosition: `${options.eventData.skip+1} - ${Math.min(options.eventData.skip + options.eventData.limit, count)} from ${count}`
	    })

    	const data = await mongodb.aggregate({
	    	db: options.db,
	    	collection: `${options.db.name}.${options.db.examinationCollection}`,
	    	pipeline: options.pipeline
		                .concat(options.syncFilter)
		                .concat(options.pageFilter)
	    })

	    res.send({
	    	options,
        	collection: data	
	    })

	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}	

const resolveTodo = r => {
    if(["Assign 2nd expert", "Assign 1st expert"].includes(r.TODO)){
        if(!r["1st expert"] && !r["2nd expert"]) return "Assign 2nd expert"
        if(!r["1st expert"] && r["2nd expert"]) return "Assign 1st expert"
        if( r["1st expert"] ) return "Continue Labeling"
    } else {
        return r.TODO
    }
}
    
const resolveAssigment = r => {
    switch (r.TODO) {
        case "Assign 2nd expert"    : 
            return r["CMO"]
            break
        case "Assign 1st expert"    : 
            return r["2nd expert"]
            break
        case "Continue Labeling"    : 
            return r["1st expert"]
            break
        case "Complete 2nd Stage"   : 
            return r["2nd expert"]
            break
        case "Complete Labeling"    : 
            return r["CMO"]
            break
        case "Finalized"            : 
            return ""
            break
    }
}


const updateTasks = async (req, res) => {
	try {
		
		let options = req.body.options
		let selection = req.body.selection
		let assignator = req.body.assignator

		let records = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.${options.db.labelingCollection}`,
			pipeline: [
	          {
	            '$match': {
	              'Examination ID': {
	                '$in': selection
	              }
	            }
	          }, {
	            '$project': {
	              '_id': 0
	            }
	          }
	        ]
		})
    	
    	records = records.map( r => {
        
	        if( ["Assign 2nd expert", "Assign 1st expert"].includes(r.TODO) ){
	            r = extend({}, r, assignator)
	            r.TODO = resolveTodo(r)
	            r["assigned to"] = resolveAssigment(r)
	        } else {
	            r["1st expert"] =  (r["1st expert"]) ? r["1st expert"] : assignator["1st expert"]
	            r["2nd expert"] =  (r["2nd expert"]) ? r["2nd expert"] : assignator["2nd expert"]
	            r["updated at"] = assignator["updated at"]
	            r["updated by"] = assignator["updated by"]
	            r.TODO = resolveTodo(r)
	            r["assigned to"] = resolveAssigment(r)
	        }   
	    	// console.log(r["updated at"], r["updated by"], assignator)    
	        return r    
	    })
    	
	    const commands = records.map( r => ({
	        replaceOne:{
	            filter:{
	                id: r.id
	            },
	            replacement: extend({}, r)
	        }
	    }))

	    const result = await mongodb.bulkWrite({
	    	db: options.db,
	    	collection: `${options.db.name}.${options.db.labelingCollection}`,
	    	commands
	    })


	    const events = records.map( r => {
		     
		     const id = uuid()

		     return {
		        replaceOne:{
		            filter:{
		                id
		            },
		            replacement: {
		            	id,
		            	dataset: options.dataset, 
						labelingId: r.id,
						todo: r.TODO,
						assignedBy: r["updated by"],
						assignedTo: r["assigned to"],
						date: r["updated at"]
		            }
		        
		        }
		    }    
	    })

	    await mongodb.bulkWrite({
	    	db: options.db,
	    	collection: `${options.db.name}.workflow-events`,
	    	events
	    })


	    res.send(result)

	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}		


	
module.exports = {
	getDatasetList,
	getTasks: getTasks1,
	getGrants,
	getStat,
	getSyncStat,
	getSyncExaminations,
	updateTasks,
	getOrganizations
}




// [
//   // {
//   //   $count: "string",
//   // }
//   {
//     $project: {
//       _id: 0,
//       id: 1,
//       "Examination ID": "$patientId",
//       state: 1,
//     },
//   },
//   {
//     $lookup: {
      // from: "harvest2",
      // localField: "Examination ID",
      // foreignField: "Examination ID",
      // pipeline: [
      //   {
      //     $project: {
      //       _id: 0,
      //       "1st expert": 1,
      //       "2nd expert": 1,
      //       "updated at": 1,
      //       "updated by": 1,
      //       TODO: 1,
      //       "Recording Informativeness": 1,
      //     },
      //   },
      // ],
      // as: "records",
//     },
//   },
//   {
//     $addFields: {
//       "1st expert": {
//         $map: {
//           input: "$records",
//           as: "r",
//           in: "$$r.1st expert",
//         },
//       },
//       "2nd expert": {
//         $map: {
//           input: "$records",
//           as: "r",
//           in: "$$r.2nd expert",
//         },
//       },
//       "updated at": {
//         $max: "$records.updated at",
//       },
//       updates: {
//         $map: {
//           input: "$records",
//           as: "r",
//           in: {
//             by: "$$r.updated by",
//             at: "$$r.updated at",
//           },
//         },
//       },
//       TODO: {
//         $map: {
//           input: "$records",
//           as: "r",
//           in: "$$r.TODO",
//         },
//       },
//       qty: {
//         $map: {
//           input: "$records",
//           as: "r",
//           in: "$$r.Recording Informativeness",
//         },
//       },
//     },
//   },
//   // {
//   //   $sort: {
//   //     "updated at": -1,
//   //   },
//   // }
//   {
//     $skip: 0,
//   },
//   {
//     $limit: 50,
//   },
//   {
//     $lookup: {
//       from: "form2",
//       localField: "id",
//       foreignField: "examinationId",
//       as: "forms",
//       pipeline: [
//         {
//           $match: {
//             type: "patient",
//           },
//         },
//       ],
//     },
//   },
//   {
//     $addFields: {
//       diagnosisTags:
//         "$forms.0.data.en.diagnosisTags",
//     },
//   },
//   {
//     $addFields: {
//       dia: {
//         $first: "$forms.data.en.diagnosisTags",
//       },
//     },
//   },
//   // {
//   //   $match: {
//   //     dia: {
//   //       $exists: true,
//   //     },
//   //   },
//   // }
//   {
//     $project: {
//       forms: 0,
//       diagnosisTags: 0,
//       records: 0,
//     },
//   },
// ]