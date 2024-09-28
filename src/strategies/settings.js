const { set, isUndefined, keys } = require("lodash")


const setProperties = (source, ops) => {
    if (!ops) return source
    let result = JSON.parse(JSON.stringify(source))
    keys(ops).map(key => {
        if (!isUndefined(ops[key])) {
            set(result, key, ops[key])
        }
    })

    result.setProperties = ops => {
        settings = setProperties(settings, ops)
    }    
    
    return result
}


let settings = {
    
    segmentator: {
        requestExpiration: [2, "hours"]
    },

    strategy: {

        Cross_Validation_2nd: {

            PARALLEL_BRANCHES: 2, // expert count
            MAX_ITERATIONS: 3, // max submit count for each stage
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

    },

}


settings.setProperties = ops => {
    settings = setProperties(settings, ops)
}    

module.exports = () => settings