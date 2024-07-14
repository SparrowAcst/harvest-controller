const mongodb = require("../mongodb")
const { isArray, find, remove, unionBy } = require("lodash")

const classification = require("./tags-old.json")

const run = async () => {
	try {	
	
		let pipeline = [
			{
			    $match: {
			      type: "patient",
			      "data.en.diagnosisTags": {
			        $exists: true,
			      },
			    }
		  	}		
		  ]		
		
		
		let forms = await mongodb.aggregate({
			db: {
			  url: "mongodb+srv://jace:jace@jace.llb8spm.mongodb.net/?retryWrites=true&w=majority",
		  	  name: "sparrow"
		  	},
			collection: `sparrow.H2-FORM`,
			pipeline
		})

		// console.log(forms)

		let commands = forms.map( f => {
			
			
			let dia = ( f.data.en.diagnosisTags.tags || [] )
						.map( t => find(classification, c => c.id == t))
						.filter ( t => t)
						.map( t => t.name)
						
			f.data.en.clinical_diagnosis = `${f.data.en.clinical_diagnosis || ""}\n\nPreliminary ADE Diagnosis\n${dia.join("\n")}`
						
			console.log(f.examinationId, f.patientId)

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

		// console.log(JSON.stringify(commands, null, " "))

		await mongodb.bulkWrite({
                db: {
				  url: "mongodb+srv://jace:jace@jace.llb8spm.mongodb.net/?retryWrites=true&w=majority",
			  	  name: "sparrow"
			  	},
			  	collection: `sparrow.H2-FORM`,
                commands
            })


	} catch(e) {
		throw e
	}	

}


run()