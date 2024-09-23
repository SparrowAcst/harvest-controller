
const Basic_Labeling = require("./Basic_Labeling")

module.exports = {
	
	Basic_Labeling_1st: Basic_Labeling,
	Basic_Relabeling_1st: Basic_Labeling,
	
	Basic_Labeling_2nd: Basic_Labeling,
	Basic_Relabeling_2nd: Basic_Labeling,
	
	Basic_Finalization: Basic_Labeling,

	Cross_Validation_2nd: require("./Cross_Validation_2nd"),
	Manual_merging: require("./Manual_merging"),
	
	linear_workflow: require("./linear_workflow"),
	tagged_record: require("./tagged_record")

}