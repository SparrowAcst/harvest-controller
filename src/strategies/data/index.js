const Basic_Labeling = require("./Basic_Labeling")

module.exports = {

    // default strategy 	
    Default: require("./Default"),

    // strategies for 1st expert 	
    Basic_Labeling_1st: Basic_Labeling({
        actual: "Basic_Labeling_1st",
        accept: "Basic_Labeling_2nd",
        permission: ["open","rollback", "sync", "history", "save", "submit"]
    }),

    Basic_Relabeling_1st: Basic_Labeling({
        actual: "Basic_Relabeling_1st",
        accept: "Basic_Labeling_2nd",
        permission: ["open", "rollback", "sync", "history", "save", "submit"]
    }),

    // strategies for 2nd expert 	
    Basic_Labeling_2nd: Basic_Labeling({
        actual: "Basic_Labeling_2nd",
        accept: "Basic_Finalization",
        reject: "Basic_Relabeling_1st",
        previus: ["Basic_Labeling_1st", "Basic_Relabeling_1st"],
        permission: ["open", "rollback", "sync", "history", "save", "reject", "submit"]
    }),

    Basic_Relabeling_2nd: Basic_Labeling({
        actual: "Basic_Relabeling_2nd",
        accept: "Basic_Finalization",
        reject: "Basic_Relabeling_1st",
        previus: ["Basic_Labeling_1st", "Basic_Relabeling_1st"],
        permission: ["open", "rollback", "sync", "history", "save", "reject", "submit"]
    }),

    Cross_Validation_2nd: require("./Cross_Validation_2nd"),

    // strategies for CMO  	

    Basic_Finalization: Basic_Labeling({
        actual: "Basic_Finalization",
        accept: "",
        reject: "Basic_Relabeling_2nd",
        previus: ["Basic_Labeling_2nd", "Basic_Relabeling_2nd"],
        permission: ["rollback", "sync", "history", "save", "reject", "submit"]
    }),

    Manual_merging: require("./Manual_merging"),

    // other strategies  	
    linear_workflow: require("./linear-workflow"),
    tagged_record: require("./tagged_record")

}