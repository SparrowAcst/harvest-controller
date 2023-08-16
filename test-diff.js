const { keys, isArray, last, first } = require("lodash")

const jsondiffpatch = require('jsondiffpatch')
const Diff = jsondiffpatch.create({
	objectHash: (d, index)  => d.name || d.id || d,
	propertyFilter: name => !([
		"updated at",
		"updated by"
	].includes(name))
})


Diff.format = (delta, parentKey) => {
	let res = []
	delta = jsondiffpatch.clone(delta)
	
	keys(delta).forEach( key => {
		
		if(key == "_t") return
		
		let publicParentKey = parentKey || ""
		let publicSelfKey = (keys(delta).includes("_t")) ? "" : key

		let publicKey = [publicParentKey,publicSelfKey].filter(d => d).join(".")	

		if(isArray(delta[key])){
			let op
			if(delta[key].length == 1) op = "insert"
			if(delta[key].length == 2) op = "update"
			if(delta[key].length == 3 && last(delta[key]) == 0 ) op = "remove"
			
			let oldValue
			if(delta[key].length == 1) oldValue = undefined
			if(delta[key].length == 2) oldValue = first(delta[key])
			if(delta[key].length == 3 && last(delta[key]) == 0 ) oldValue = first(delta[key])

			let newValue
			if(delta[key].length == 1) newValue = last(delta[key])
			if(delta[key].length == 2) newValue = last(delta[key])
			if(delta[key].length == 3 && last(delta[key]) == 0 ) newValue = undefined

			res.push({
				key: publicKey,
				op,
				oldValue,
				newValue
			})

		} else {

			res = res.concat(Diff.format(delta[key], publicKey))

		}	

	})

	return res
}


let prev = {
  "id": "305c59dd-d8b4-4dbb-91d2-4c7c9b7bbc63",
  "Segmentation URL": "http://ec2-54-235-192-121.compute-1.amazonaws.com:8002/?record_v3=9ASbG0DQawa2ajr0APjbqhVz8pG2/recordings/Android_0cQ7cB0q4chJNuzjnAK2&patientId=POT0010&position=supine&spot=leftAbdomen&device=android",
  "Examination ID": "POT0010",
  "Source": {
    "path": "9ASbG0DQawa2ajr0APjbqhVz8pG2/recordings/Android_0cQ7cB0q4chJNuzjnAK2",
    "url": "https://firebasestorage.googleapis.com/v0/b/stethophonedata.appspot.com/o/9ASbG0DQawa2ajr0APjbqhVz8pG2%2Frecordings%2FAndroid_0cQ7cB0q4chJNuzjnAK2?alt=media&token=d2deb9ff-0c2f-4d1f-8ea9-3be8d20685c5"
  },
  "Clinic": "POTASHEV",
  "Age (Years)": "47",
  "Sex at Birth": "Male",
  "Ethnicity": "White",
  "model": "android",
  "Body Position": "supine",
  "Body Spot": "Left abdomen",
  "Recording Informativeness": "Good",
  "Type of artifacts , Artifact": ["Movement", "Unclassified artifact"],
  "Systolic murmurs": [],
  "Diastolic murmurs": [],
  "Other murmurs": [],
  "Pathological findings": [],
  "path": "9ASbG0DQawa2ajr0APjbqhVz8pG2/recordings/Android_0cQ7cB0q4chJNuzjnAK2",
  "state": "Assign 2nd expert",
  "CMO": "Yaroslav Shpak",
  "TODO": "Continue Labeling",
  "updated at": "2023-03-21T21:16:24.229Z",
  "updated by": "Oleh Shpak",
  "Stage Comment": "Added by import utils",
  "assigned to": "Marco Antonio Lopez Garcia",
  "1st expert": "Marco Antonio Lopez Garcia",
  "2nd expert": "Oleh Shpak",
  "SOUND_FILE_EXISTS": true,
  "supd": true,
  "Confidence": "Not Confident",
  "deviceDescription": {
    "brand": "Samsung Galaxy",
    "deviceId": "N/A",
    "manufacturer": "Samsung",
    "model": "Samsung Galaxy S22 Ultra",
    "osVersion": "N/A"
  }
}

let curr = {
  "id": "305c59dd-d8b4-4dbb-91d2-4c7c9b7bbc63",
  "Segmentation URL": "http://ec2-54-235-192-121.compute-1.amazonaws.com:8002/?record_v3=9ASbG0DQawa2ajr0APjbqhVz8pG2/recordings/Android_0cQ7cB0q4chJNuzjnAK2&patientId=POT0010&position=supine&spot=leftAbdomen&device=android",
  "Examination ID": "POT0010",
  "Source": {
    "path": "9ASbG0DQawa2ajr0APjbqhVz8pG2/recordings/Android_0cQ7cB0q4chJNuzjnAK2",
    "url": "https://firebasestorage.googleapis.com/v0/b/stethophonedata.appspot.com/o/9ASbG0DQawa2ajr0APjbqhVz8pG2%2Frecordings%2FAndroid_0cQ7cB0q4chJNuzjnAK2?alt=media&token=d2deb9ff-0c2f-4d1f-8ea9-3be8d20685c5"
  },
  "Clinic": "POTASHEV",
  "Age (Years)": "47",
  "Sex at Birth": "Male",
  "Ethnicity": "White",
  "model": "android",
  "Body Position": "supine",
  "Body Spot": "Left abdomen",
  "Recording Informativeness": "Bad",
  "Type of artifacts , Artifact": ["Electrical interference", "Movement"],
  "Systolic murmurs": [],
  "Diastolic murmurs": [],
  "Other murmurs": [],
  "Pathological findings": [],
  "path": "9ASbG0DQawa2ajr0APjbqhVz8pG2/recordings/Android_0cQ7cB0q4chJNuzjnAK2",
  "state": "Assign 2nd expert",
  "CMO": "Yaroslav Shpak",
  "TODO": "Continue Labeling",
  "updated at": "2023-03-24T21:16:24.229Z",
  "updated by": "Olehs Shpak",
  "Stage Comment": "Added by import utils",
  "assigned to": "Marco Antonio Lopez Garcia",
  "1st expert": "Marco Antonio Lopez Garcia",
  "2nd expert": "Oleh Shpak",
  "SOUND_FILE_EXISTS": true,
  "supd": true,
  "Confidence": "Not Confident",
  "deviceDescription": {
    "brand": "Samsung Galaxy",
    "deviceId": "N/A",
    "manufacturer": {
    	name: "Samsung"
    },
    "model": "Samsung Galaxy S22 Ultra+",
    "osVersion": "N/A"
  }
}


console.log(Diff.diff(prev, curr))
console.log(Diff.format(Diff.diff(prev, curr)))
