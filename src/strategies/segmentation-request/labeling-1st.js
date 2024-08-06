
const openRequest = async options => {
	

	let { version } = options


	let result = {
		"patientId": version.metadata.patientId,
		"recordId": version.data.id,
		"spot": version.data["Body Spot"],
		"device": version.data.model,
		"path": version.data.path,
		"inconsistency": [],
		"data": [
			{
				user: version.user || "main",
				readonly: version.readonly,
				segmentation: version.data.segmentation
			},
			{
				user: "AI",
				readonly: true,
				segmentation: version.data.aiSegmentation
			}
		]
			
	}

	return result

}




module.exports = {
	openRequest
}