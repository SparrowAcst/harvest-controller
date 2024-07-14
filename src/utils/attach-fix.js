const mongodb = require("../mongodb")
const { isArray, find, remove, unionBy, first, last } = require("lodash")
const { getMIMEType } = require('node-mime-types')

const ids = require("./H3-ATTACHEMENTS-TEMP.json").map( d => d.patientId)

const run = async () => {
	try {	
	
		let pipeline = [
			{
			    $match: {
			      type: "attachements",
			      patientId: {
			      	$in: ids
			      }
			    }
		  	},
		  	{
		  		$project:{
		  			_id: 0
		  		}
		  	}		
		  ]		
		
		
		let forms = await mongodb.aggregate({
			db: {
			  url: "mongodb+srv://jace:jace@jace.llb8spm.mongodb.net/?retryWrites=true&w=majority",
		  	  name: "sparrow"
		  	},
			collection: `sparrow.H3-FORM`,
			pipeline
		})

		// console.log(forms)

		let commands = forms.map( f => {
			
			f.data = f.data.map( d => {
				if(!d.name) return
				if(last(d.name.split(".")) == "undefined"){
					d.name = first(d.name.split("."))+".jpg"	
				}
				d.mimeType = getMIMEType(d.name)
				return d
			})
			
			return {
				replaceOne: {
					filter: {
						id: f.id,
						examinationId: f.examinationId
					},
					replacement: f,
				}
			}	

		})

		commands = commands.filter( d => d)
		
		// console.log(JSON.stringify(commands, null, " "))

		await mongodb.bulkWrite({
                db: {
				  url: "mongodb+srv://jace:jace@jace.llb8spm.mongodb.net/?retryWrites=true&w=majority",
			  	  name: "sparrow"
			  	},
			  	collection: `sparrow.H3-FORM`,
                commands
            })


	} catch(e) {
		throw e
	}	

}


run()