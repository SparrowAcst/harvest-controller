const task = {
    "Labeling": require("./labeling-1st"),
    "labeling_2nd": require("./labeling-2nd"),
}

module.exports = {
    
    "1st expert": [
        task["Labeling"]
    ],

    "admin": [
        task["Labeling"],
        task["labeling_2nd"]
    ],

    "2nd expert": [
        task["labeling_2nd"],
        task["Labeling"]
    ]

}