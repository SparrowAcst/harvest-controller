const mongodb = require("./mongodb")
const {extend, sortBy, uniq, flattenDeep, find, last} = require("lodash")
const moment = require("moment")
const uuid = require("uuid").v4
const YAML = require("js-yaml")
const fs = require("fs")
const path = require("path")
const { Diff, SegmentationDiff } = require("./utils/diff")
const url = require('url')
const CONFIG = YAML.load(fs.readFileSync(path.join(__dirname,`../../sync-data/.config/db/mongodb.conf.yml`)).toString().replace(/\t/gm, " "))

const getGrants = async (req, res) => {

	try {

		let user = req.body.user

		options = extend( {}, CONFIG, {
			collection: `${CONFIG.db.name}.app-grant`,
			pipeline: [   
	            {
	            	$match: {
	            		email: user.email
	            	}
	            },
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

	
module.exports = {
	getGrants
}