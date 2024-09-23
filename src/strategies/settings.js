module.exports = {
    
    segmentator: {
        requestExpiration: [1, "seconds"]
    },

    strategy: {

        Cross_Validation_2nd: {

            PARALLEL_BRANCHES: 2, // expert count
            MAX_ITERATIONS: 1, // max submit count for each stage
            MAX_STAGES: 1, // after MAX_STAGES  stages "manual merge task" will be generated
        
        }

    },

    dataVersion: {
        
        EXPIRATION_PERIOD: [1, "seconds"], // rollback available in this period

        dataView: d => ((d)
            ? {

                "Patient ID": d["Examination ID"],
                "Device": d.model,
                "Body Spot": d["Body Spot"]
            
                }
            : {})    

    }

}