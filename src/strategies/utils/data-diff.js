const {
    isArray,
    keys,
    first,
    last

} = require("lodash")

const jsondiffpatch = require('jsondiffpatch')

const checkedFields = [
    // "Heart Sound Informativeness",
    // "Lung Sound Informativeness",
    "S3",
    "S4",
    "Pathological findings",
    "Rhythm and Arrhythmias",
    "Systolic murmurs",
    "Diastolic murmurs",
    "Other murmurs"
    ]

const checker = jsondiffpatch.create({
    objectHash: (d, index)  => {
        // console.log("CHECK", d)
        let c = JSON.parse(JSON.stringify(d))
        delete c.grade
        // console.log(">> ",JSON.stringify(c))
        return JSON.stringify(c)
    },

    propertyFilter: name => checkedFields.includes(name) 
})



const format = (delta, parentKey) => {
    
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

            res = res.concat(format(delta[key], publicKey))

        }   

    })

    return res
}


module.exports = {
    checkedFields,
    checker,
    getDifference: (d1, d2) => {
        let patch = checker.diff(d1, d2)
        return {
            patch,
            formatted: format(patch) 
        }
    }    
}


