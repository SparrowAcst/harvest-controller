const {
    isArray,
    find,
    first,
    last,
    sortBy,
    keys,
    findIndex,
    maxBy,
    zipObject,
    flattenDeep,
    flatten,
    values,
    uniqWith,
    isEqual,
    mean,
    extend,
    groupBy,
    uniqBy,
    chunk

} = require("lodash")

const { avg, std, quantile, confidenceInterval, min, max } = require("../../utils/stat")

const Diff = require('jsondiffpatch')

const Polygon = require("./polygon")

const SEGMENT_TYPES = [
    "S1",
    "S2",
    "S3",
    "S4",
    "unsegmentable",
    "Inhale",
    "systole",
    "diastole"
]

const CHECKED_SEGMENT_TYPES = [
    "S1",
    "S2",
    "S3",
    "S4",
    "unsegmentable",
    "Inhale"
]

const segmentTypes = {
    'S1': { color: '#ef6c00' },
    'S2': { color: '#1a237e' },
    'S3': { color: '#c8e6c9' },
    'S4': { color: '#ffe082' },
    'systole': { color: '#f9a825' },
    'diastole': { color: '#7986cb' },
    'unsegmentable': { color: '#e0e0e0' },
    'Inhale': { color: '#b2ebf2' }
}

let series = [
    // {
    //     name: "unsegmentable",
    //     segments: ["unsegmentable"]
    // },
    {
        name: "Heart Cycle",
        segments: ["S1", "S2", "systole", "diastole", "unsegmentable"]

    },
    {
        name: "S3-S4",
        segments: ["S3", "S4"]

    },
    {
        name: "breath",
        segments: ["Inhale"]
    },
]



const parseV1 = segmentation => {
    let segments = []

    segments = keys(segmentation).filter(key => key != "v2").map(key => ({
        type: segmentation[key][0][1],
        start: Number.parseFloat(key),
        end: Number.parseFloat(segmentation[key][0][0])
    }))
    return segments
}

const parseV2 = segmentation => {

    let segments = []
    keys(segmentation).forEach(key => {

        if (key == "v2" || !isArray(segmentation[key])) return

        segments = segments.concat(segmentation[key].map(s => ({
            type: key,
            start: Number.parseFloat(s[0]),
            end: Number.parseFloat(s[1]),
            lf: Number.parseFloat(s[2]),
            hf: Number.parseFloat(s[3]),
        })))
    })

    return segments

}

const matchPattern = (array, pattern) => pattern.map((p, index) => array[index] == p).reduce((v, a) => v && a, true)

const splitByPattern = (array, pattern) => {

    const temp = array.map(s => s)
    let res = []

    for (; temp.length >= pattern.length;) {

        let buf = temp.slice(0, pattern.length)
        if (matchPattern(buf.map(b => b.type), pattern)) {
            res.push(buf)
        }
        temp.shift()
    }

    return res

}


const parseAI = segmentation => {

    const type2name = {
        s1: "S1",
        s2: "S2",
        S1: "S1",
        S2: "S2",
        unsegmentable: "unsegmentable"
    }

    let segments = sortBy(segmentation.map(s => {
        s.type = type2name[s.type]
        return s
    }), d => d.start)

    const sysPattern = ["S1", "S2"]
    const diaPattern = ["S2", "S1"]

    const sysSegments = splitByPattern(segments, sysPattern).map(d => ({
        type: "systole",
        start: d[0].end,
        end: d[1].start
    }))

    const diaSegments = splitByPattern(segments, diaPattern).map(d => ({
        type: "diastole",
        start: d[0].end,
        end: d[1].start
    }))

    return sortBy(segments.concat(sysSegments).concat(diaSegments), s => s.start)

}

const parsePolygons = segmentation => {
    const types = [
        "S1",
        "S2",
        "S3",
        "S4",
        "unsegmentable",
        "Inhale"
    ]

    let segments = sortBy(
        flatten(
            types.map(t => segmentation
                .filter(s => s.name == t)
                .map(s => ({
                    type: t,
                    start: min(s.points.map(p => p[0])),
                    end: max(s.points.map(p => p[0])),
                    lf: min(s.points.map(p => p[1])),
                    hf: max(s.points.map(p => p[1])),
                }))
            )
        ), s => s.start
    )

    const sysPattern = ["S1", "S2"]
    const diaPattern = ["S2", "S1"]

    const sysSegments = splitByPattern(segments.filter(s => ["S1", "S2", "unsegmentable"].includes(s.type)), sysPattern).map(d => ({
        type: "systole",
        start: d[0].end,
        end: d[1].start
    }))


    const diaSegments = splitByPattern(segments.filter(s => ["S1", "S2", "unsegmentable"].includes(s.type)), diaPattern).map(d => ({
        type: "diastole",
        start: d[0].end,
        end: d[1].start
    }))

    let res = sortBy(segments.concat(sysSegments).concat(diaSegments), s => s.start)
    return res

}


const parsePoly = segmentation => {
    
    if (!segmentation.Murmur) return []
    if(segmentation.Murmur.length == 0) return []
    if(!segmentation.Murmur[0].points) return []
        
    let items = groupBy(segmentation.Murmur, s => s.name)

    items = keys(items)
        .map(key => ({
            name: key,
            shapes: Polygon.array2Polygons(items[key].map(d => d.points))
        }))
        .filter(d => d.name != "undefined")

    return items    

}


const parse = segmentation => {

    let segments = []
    let polygons = []

    if (isArray(segmentation)) {
        if (segmentation[0] && segmentation[0].points) {
            segments = parsePolygons(segmentation)
            
        } else {
            segments = parseAI(segmentation)
        }

    } else if (segmentation && (segmentation.S1 || segmentation.S2 || segmentation.unsegmentable)) {

        segments = parseV2(segmentation)
        polygons = parsePoly(segmentation)

    } else if (segmentation) {

        segments = parseV1(segmentation)
    }
    
    return {
        original: segmentation,
        segments, 
        polygons
    }

}


const getSegmentationChart = (sa, nonConsistencyIntervals) => {

    let segments = JSON.parse(JSON.stringify(sa.segmentation.segments))
    
    // console.log("segments", segments)

    nonConsistencyIntervals = nonConsistencyIntervals || []

    let murmurCategories = uniqBy(segments.map(s => s.type)).filter(d => !SEGMENT_TYPES.includes(d))
    murmurCategories = murmurCategories.filter( d => d != "Murmur")


    let m = SEGMENT_TYPES.map(type => max(segments.filter(s => s.type == type).map(s => s.hf)) || 1)
    m = m.concat(murmurCategories.map(d => 1))

    m = zipObject(SEGMENT_TYPES.concat(murmurCategories), m)

    // let customSeries = JSON.parse(JSON.stringify(series)).concat(murmurCategories.map(d => ({name: d, segments: [d]})))
    let customSeries = murmurCategories
        .map(d => ({ name: d, segments: [d] }))
        .concat(JSON.parse(JSON.stringify(series)))
        .filter(d => {
            return segments.filter(s => d.segments.includes(s.type)).length > 0
        })

    segments = segments.map(s => {
        s.name = s.type
        s.itemStyle = {
            normal: {
                color: (segmentTypes[s.type]) ? segmentTypes[s.type].color || "#ede7f6" : "#ede7f6",
                borderColor: "#999",
                borderWidth: 0.3,
                // opacity: 0.5
            }
        }
        let categoryIndex = findIndex(customSeries, serie => serie.segments.includes(s.type))
        s.value = [categoryIndex, s.start, s.end, (s.hf || 1) / m[s.type]]
        return s
    })

    let data = customSeries.map(s => ({
        name: s.name,
        data: segments.filter(seg => s.segments.includes(seg.type))
    }))


    let options = {
        "toolbox": {
            "feature": {
                "saveAsImage": {}
            }
        },
        tooltip: {
            formatter: `params => {
                return params.marker + params.name + ': started at ' + params.value[1] + ' s';
            }`
        },
        dataZoom: [{
                type: 'slider',
                filterMode: 'weakFilter',
                showDataShadow: false,
                labelFormatter: ''
            },
            {
                type: 'inside',
                filterMode: 'weakFilter'
            }
        ],
        grid: {
            containLabel: true
        },
        xAxis: {
            min: 0,
            max: maxBy(segments.map(s => s.end)),
            scale: true,
            axisLabel: {
                formatter: function(val) {
                    return val + ' s';
                }
            },
            minorTick: {
                show: true
            },
            minorSplitLine: {
                show: true
            }
        },

        yAxis: {
            data: customSeries.map(s => s.name),
            splitLine: {
                show: true
            }
        },

        series: [{
            type: 'custom',
            renderItem: `

            (params, api) => {
  
              var categoryIndex = api.value(0);
              var start = api.coord([api.value(1), categoryIndex]);
              var end = api.coord([api.value(2), categoryIndex]);
              var height = api.size([0, 1])[1] *api.value(3) //categoryIndex])[1];  //api.size([0, 1])[1] * 0.1;
              var rectShape = echarts.graphic.clipRectByRect(
                {
                  x: start[0],
                  y: start[1] + api.size([0, 1])[1]/2 - height * 0.9,
                  width: end[0] - start[0],
                  height: height * 0.9
                },
                {
                  x: params.coordSys.x,
                  y: params.coordSys.y,
                  width: params.coordSys.width,
                  height: params.coordSys.height
                }
              );
              return (
                rectShape && {
                  type: 'rect',
                  transition: ['shape'],
                  shape: rectShape,
                  style: api.style()
                }
              );
            }
          `,
            itemStyle: {
                opacity: 0.8
            },
            encode: {
                x: [1, 2],
                y: 0,
                v: 3
            },
            data: segments,

            markArea: {
                "itemStyle": {
                    "color": "#fff3e0",
                    "opacity": 0.7,
                    borderWidth: 1,
                    borderType: "dashed",
                    borderColor: "red"
                },
                data: nonConsistencyIntervals.map(interval => [{
                        xAxis: interval.start
                    },
                    {
                        xAxis: interval.end
                    }
                ])
            }
        }]
    }

    return options

}



const getMultiSegmentationChart = (segmentations, nonConsistencyIntervals) => {

    nonConsistencyIntervals = nonConsistencyIntervals || []

    segmentations = (isArray(segmentations || [])) ? segmentations : [segmentations]

    let pool = []

    segmentations.forEach((segmentation, index) => {

        let segments = parse(segmentation)

        let m = SEGMENT_TYPES.map(type => max(segments.filter(s => s.type == type).map(s => s.hf)) || 1)
        m = zipObject(SEGMENT_TYPES, m)

        segments = segments.map(s => {
            s.name = s.type
            s.itemStyle = {
                normal: {
                    color: (segmentTypes[s.type]) ? segmentTypes[s.type].color || "black" : "black",
                    borderColor: "#999",
                    borderWidth: 0.3,
                    // opacity: 0.3
                }
            }
            let categoryIndex = findIndex(series, serie => serie.segments.includes(s.type))
            s.value = [categoryIndex, s.start, s.end, (s.hf || 1) / m[s.type], index / segmentations.length, segmentations.length]
            return s
        })

        pool = pool.concat(segments)

    })

    let data = series.map(s => ({
        name: s.name,
        data: pool.filter(seg => s.segments.includes(seg.type))
    }))

    let options = {
        "toolbox": {
            "feature": {
                "saveAsImage": {}
            }
        },
        tooltip: {
            formatter: `params => {
                return params.marker + params.name + ': started at ' + params.value[1] + ' s';
            }`
        },
        dataZoom: [{
                type: 'slider',
                filterMode: 'weakFilter',
                showDataShadow: false,
                labelFormatter: ''
            },
            {
                type: 'inside',
                filterMode: 'weakFilter'
            }
        ],
        grid: {
            containLabel: true
        },
        xAxis: {
            min: 0,
            max: maxBy(pool.map(s => s.end)),
            scale: true,
            axisLabel: {
                formatter: function(val) {
                    return val + ' s';
                }
            },
            minorTick: {
                show: true
            },
            minorSplitLine: {
                show: true
            }
        },

        yAxis: {
            data: series.map(s => s.name),
            splitLine: {
                show: true
            }
        },

        series: [{
            type: 'custom',
            renderItem: `

            (params, api) => {
  
              var categoryIndex = api.value(0);
              var start = api.coord([api.value(1), categoryIndex]);
              var end = api.coord([api.value(2), categoryIndex]);
              var height = api.size([0, 1])[1] *api.value(3) //categoryIndex])[1];  //api.size([0, 1])[1] * 0.1;
              var rectShape = echarts.graphic.clipRectByRect(
                {
                  x: start[0],
                  y: start[1] + api.size([0, 1])[1]/2 - height * api.value(4) * 0.9 - api.size([0, 1])[1] / api.value(5)  ,
                  width: end[0] - start[0],
                  height: height  * 0.8 / api.value(5)
                },
                {
                  x: params.coordSys.x,
                  y: params.coordSys.y,
                  width: params.coordSys.width,
                  height: params.coordSys.height
                }
              );
              return (
                rectShape && {
                  type: 'rect',
                  transition: ['shape'],
                  shape: rectShape,
                  style: api.style()
                }
              );
            }
          `,
            itemStyle: {
                opacity: 0.8
            },
            encode: {
                x: [1, 2],
                y: 0,
                v: 3,
                i: 4,
                l: 5
            },
            data: pool,

            markArea: {
                "itemStyle": {
                    "color": "#fff3e0",
                    "opacity": 0.7,
                    borderWidth: 1,
                    borderType: "dashed",
                    borderColor: "red"
                },
                data: nonConsistencyIntervals.map(interval => [{
                        xAxis: interval.start
                    },
                    {
                        xAxis: interval.end
                    }
                ])
            }
        }]
    }

    return options

}


const select = (sa, ...types) => {

    let segments = sa.segmentation.segments
    let selector = (types && isArray(types) && types.length > 0) ? (s => types.includes(s.type)) : (s => s)
    segments = sortBy(segments, s => s.start).filter(selector)
    return segments
}

const getCardioCycles = (sa, patternName) => {

    let segments = select(sa, "S1", "S2", "unsegmentable")

    if (!segments || segments.length == 0) return []

    let temp = segments.map(s => s)

    const HC_Pattern = {
        "S1S1": [{
                type: "S1",
                "required": true
            },
            {
                type: "systole"
            },
            {
                type: "S2",
                "required": true
            },
            {
                type: "diastole"
            },
            {
                type: "S1",
                "required": true
            }
        ],

        "S2S2": [{
                type: "S2",
                "required": true
            },
            {
                type: "diastole"
            },
            {
                type: "S1",
                "required": true
            },
            {
                type: "systole"
            },
            {
                type: "S2",
                "required": true
            }
        ],
    }

    const pattern = HC_Pattern[patternName] || HC_Pattern["S1S1"]

    const p1 = pattern.map(p => p.type)
    const p2 = pattern.filter(p => p.required).map(p => p.type)

    let res = []

    for (; temp.length >= pattern.length;) {

        let buf1 = temp.slice(0, p1.length)
        let buf2 = temp.slice(0, p2.length)

        if (matchPattern(buf1.map(b => b.type), p1)) {
            res.push(buf1)
        } else if (matchPattern(buf2.map(b => b.type), p2)) {
            res.push(buf2)
        }

        temp.shift()

    }

    return res

}

const getHeartRate = sa => {

    let cardioCycles = getCardioCycles(sa, "S1S1").concat(getCardioCycles(sa, "S2S2"))

    let res = cardioCycles.map(c => ({
        segments: c,
        rate: 60 / (last(c).start - c[0].start),
        duration: (last(c).start - c[0].start)
    }))

    if (res.length > 0) {
        res = {
            duration: res.map(d => d.duration),
            avg: avg(res.map(d => d.rate)),
            std: std(res.map(d => d.rate)),
            delta: confidenceInterval(res.map(d => d.rate), 0.95)
        }
    } else {
        res = {
            duration: res.map(d => d.duration),
            avg: 0,
            std: 0,
            delta: 0
        }
    }

    return res
}



const getBreathRate = sa => {

    let segments = sortBy(select(sa, "Inhale"), s => s.start)

    let res = []

    for (; segments.length >= 2;) {
        res.push(60 / (segments[1].start - segments[0].start))
        res.push(60 / (segments[1].end - segments[0].end))
        segments.shift()
    }

    if (res.length == 0) {
        return {
            avg: 0,
            delta: 0
        }
    }

    return {
        avg: avg(res),
        std: std(res),
        delta: confidenceInterval(res, 0.95)
    }

}

const getDepricated = sa => {

    let segments = select(sa, "unsegmentable")

    let deprecated = segments.map(s => s.end - s.start).reduce((a, v) => a + v, 0)
    let duration = getDuration(sa)

    return {
        value: deprecated,
        percents: 100 * deprecated / duration
    }
}

const getDuration = sa => {

    let segments = select(sa)
    return max(segments.map(s => s.end))

}

const getSystoleDiastole = sa => {


    let systole = select(sa, "systole").map(d => {
        d.duration = Number.parseFloat((d.end - d.start).toFixed(4))
        return d
    })


    let diastole = select(sa, "diastole").map(d => {
        d.duration = Number.parseFloat((d.end - d.start).toFixed(4))
        return d
    })

    if(systole.length > 0 && diastole.length > 0){
        return extend(sa, { systole, diastole })    
    }
    
    if( select(sa,"S1").length > 0 && select(sa,"S2").length > 0){

        const sysPattern = ["S1", "S2"]
        const diaPattern = ["S2", "S1"]

        let segments = select(sa, "S1","S2","unsegmentable")

        const sysSegments = splitByPattern(segments, sysPattern).map(d => ({
            type: "systole",
            start: d[0].end,
            end: d[1].start
        }))

        const diaSegments = splitByPattern(segments, diaPattern).map(d => ({
            type: "diastole",
            start: d[0].end,
            end: d[1].start
        }))

        sa.segmentation.segments = sa.segmentation.segments.concat(sysSegments).concat(diaSegments)

        return getSystoleDiastole(sa)

    } else {

        sa.systole = []
        sa.diastole = []
        return sa

    }    

}


const getTotals = sa => {

    let cardioCycles = getCardioCycles(sa)

    if (cardioCycles.lengyh == 0) return {
        cardioCycles: [],
        heartRate: {},
        breathRate: {},
        deprecated: null,
        duration: null,
        systole: [],
        diastole: []
    }

    let res = extend({}, sa, { cardioCycles })

    let heartRate = getHeartRate(sa)
    let deprecated = getDepricated(sa)
    let duration = getDuration(sa)
    let breathRate = getBreathRate(sa)

    return extend({},
        res, 
        {
            heartRate,
            breathRate,
            deprecated,
            duration
        }
    )
}



const getSystoleDiastoleBars = sa => {

    let segments = select(sa, "systole", "diastole").map(d => {
        d.duration = Number.parseFloat((d.end - d.start).toFixed(4))
        return d
    })

    if (segments.length == 0) return {}

    while (first(segments).type != "systole") {
        segments.shift()
    }

    segments = chunk(segments, 2)

    if (last(segments).length < 2) {
        segments.pop()
    }


    let systole = segments.map(d => d[0].duration)
    let diastole = segments.map(d => d[1].duration)

    let sysdia = systole.map((s, index) => s + diastole[index])

    let s = {
        avg: avg(systole),
        std: std(systole),
        ci: confidenceInterval(systole),
        max: max(systole)
    }

    let d = {
        avg: avg(sysdia),
        std: std(sysdia),
        ci: confidenceInterval(sysdia),
        max: max(sysdia)
    }


    let option = {
        legend: {
            data: [
                "Systole",
                "Diastole"
            ]
        },
        xAxis: {
            type: 'category',

        },
        yAxis: {
            type: 'value',
            max: Number.parseFloat((Math.max(d.max, d.avg + d.ci) + 0.03).toFixed(1))
        },
        series: [{
                name: "Systole",
                barWidth: "40%",
                data: systole,
                color: "#f9a825",
                type: 'bar',
                itemStyle: {
                    borderColor: "#ef6c00",
                    borderWidth: 2
                },
                stack: "glob",
                markArea: {
                    itemStyle: {
                        color: 'rgba(255, 50, 50, 0.1)'
                    },
                    data: [
                        [{
                                yAxis: s.avg - s.ci
                            },
                            {
                                yAxis: s.avg + s.ci
                            }
                        ]
                    ]
                },
                markLine: {
                    silent: true,
                    symbol: [],
                    lineStyle: {
                        color: 'red',
                    },
                    data: [{
                            yAxis: s.avg - s.ci,
                            lineStyle: {
                                width: 1
                            }
                        },
                        {
                            yAxis: s.avg + s.ci,
                            lineStyle: {
                                width: 1
                            }
                        },
                    ]
                },
            },
            {
                name: "Diastole",
                data: diastole,
                color: "#7986cb",
                type: 'bar',
                itemStyle: {
                    borderColor: "#1a237e",
                    borderWidth: 2
                },
                stack: "glob",
                markArea: {
                    itemStyle: {
                        color: 'rgba(125, 125, 150, 0.05)'
                    },
                    data: [
                        [{
                                yAxis: d.avg - d.ci
                            },
                            {
                                yAxis: d.avg + d.ci
                            }
                        ]
                    ]
                },
                markLine: {
                    silent: true,
                    symbol: [],
                    lineStyle: {
                        color: 'blue',
                    },
                    data: [
                        // {
                        //   xAxis: diastoleAvg,
                        //   lineStyle: {
                        //     width:3
                        //   }
                        // },
                        {
                            yAxis: d.avg - d.ci,
                            lineStyle: {
                                width: 1
                            }
                        },
                        {
                            yAxis: d.avg + d.ci,
                            lineStyle: {
                                width: 1
                            }
                        },
                    ]
                },
            }
        ]
    }

    return option
}

/////////////////////////////////////////////////////////////////////////////////////////////////////



const getSystoleDiastoleScatterPlot = sa => {

    let values = []

    if (!sa.systole) return {}

    let systole = sa.systole.map(d => d.duration)
    let diastole = sa.diastole.map(d => d.duration)


    for (let i = 0; i < systole.length; i++) {
        values.push([systole[i], diastole[i]])
    }

    let minx = min(values.map(d => d[0]))
    let maxx = max(values.map(d => d[0]))
    minx = minx - 1.75 * (maxx - minx)
    maxx = maxx + 1.75 * (maxx - minx)

    let miny = min(values.map(d => d[1]))
    let maxy = max(values.map(d => d[1]))
    miny = miny - 0.1 * (maxy - miny)
    maxy = maxy + 0.25 * (maxy - miny)


    let min_ = Number.parseFloat(min([minx, miny]).toFixed(4))
    let max_ = Number.parseFloat(max([maxx, maxy]).toFixed(4))

    min_ = 0

    return {
        grid: {
            width: 300,
            height: 300,
            left: "center",
            top: "center"
        },
        xAxis: {
            name: "Systole, s",
            nameLocation: "center",
            nameTextStyle: {
                fontWeight: "bold"
            },
            nameGap: 25,
            min: min_,
            max: max_,
        },
        yAxis: {
            name: "Diastole, s",
            nameLocation: "center",
            nameTextStyle: {
                fontWeight: "bold"
            },
            nameGap: 30,
            min: min_,
            max: max_,
        },
        series: [{
            symbolSize: 6,
            color: "#234758",
            data: values,
            type: 'scatter',
        }]
    }
}


const getS4S1interval = sa => {

    let pool = sortBy(select(sa, "S4", "S1", "unsegmentable"), d => d.start)

    let res = []
    for (let i = 0; i < pool.length - 1; i++) {
        if (pool[i].type == "S4" && pool[i + 1].type == "S1") {
            res.push({
                type: "S4-S1",
                start: pool[i].start,
                end: pool[i + 1].start
            })
        }
    }

    return res

}

const getS2S3interval = sa => {

    let pool = sortBy(select(sa, "S2", "S3", "unsegmentable"), d => d.start)

    let res = []
    for (let i = 0; i < pool.length - 1; i++) {
        if (pool[i].type == "S2" && pool[i + 1].type == "S3") {
            res.push({
                type: "S2-S3",
                start: pool[i].start,
                end: pool[i + 1].start
            })
        }
    }

    return res

}



const getSegmentDurationBoxplot = sa => {

    let pool = select(sa).concat(getS4S1interval(sa)).concat(getS2S3interval(sa))

    let seg = [
        "S1",
        "S2",
        "S3",
        "S4",
        "S4-S1",
        "S2-S3",
        "systole",
        "diastole"
    ]
    seg.reverse()

    seg = seg
        .map(s => {
            return {
                type: s,
                seg: pool.filter(p => p.type == s).map(d => Number.parseFloat((d.end - d.start).toFixed(4)))
            }
        })
        .filter(d => d.seg.length > 0)
        .map(d => {
            d.box = [quantile(d.seg, 0), quantile(d.seg, 0.25), quantile(d.seg, 0.5), quantile(d.seg, 0.75), quantile(d.seg, 0.999)]
            d.seg = d.seg.map(s => [s, d.type])
            return d
        })


    return {
        grid: {
            containLabel: true
        },
        tooltip: {
            trigger: 'item',
            axisPointer: {
                type: 'shadow'
            }
        },
        yAxis: {
            type: 'category',
            data: seg.map(d => d.type),
            boundaryGap: true
        },
        xAxis: {
            type: 'value',
            name: 'Duration, s',
            nameLocation: "center",
            nameTextStyle: {
                fontWeight: "bold"
            },
            nameGap: 25,
            minorTick: {
                show: true,
                splitNumber: 10
            },
            minorSplitLine: {
                show: true
            }
        },
        series: [{
                name: 'Segment duration',
                type: 'boxplot',
                color: "#234758",
                itemStyle: {
                    borderWidth: 1
                },
                data: seg.map(d => d.box)
            },
            {
                name: 'outlier',
                type: 'scatter',
                color: "#234758",
                symbolSize: 8,
                data: flatten(seg.map(d => d.seg))
            }
        ]
    }
}


const getHFBoxplot = sa => {

    let pool = select(sa, "S3", "S4").map(d => ({
        type: d.type,
        hf: d.hf
    }))

    if (pool.length == 0) {
        return {

            title: [{
                left: 'center',
                top: "center",
                text: 'No data',
                textStyle: {
                    color: "#aeaeae"
                }
            }]
        }
    }

    let seg = [
        "S3",
        "S4",
    ]

    seg.reverse()



    seg = seg
        .map(s => {
            return {
                type: s,
                seg: pool.filter(p => p.type == s).map(d => Number.parseFloat((d.hf).toFixed(1)))
            }
        })
        .filter(d => d.seg.length > 0)
        .map(d => {
            d.box = [quantile(d.seg, 0), quantile(d.seg, 0.25), quantile(d.seg, 0.5), quantile(d.seg, 0.75), quantile(d.seg, 0.999)]
            d.seg = d.seg.map(s => [s, d.type])
            return d
        })

    return {
        grid: {
            containLabel: true
        },
        tooltip: {
            trigger: 'item',
            axisPointer: {
                type: 'shadow'
            }
        },
        yAxis: {
            type: 'category',
            data: seg.map(d => d.type),
            boundaryGap: true
        },
        xAxis: {
            type: 'value',
            name: 'Frequancy, hz',
            nameLocation: "center",
            nameTextStyle: {
                fontWeight: "bold"
            },
            nameGap: 25,
            minorTick: {
                show: true,
                splitNumber: 10
            },
            minorSplitLine: {
                show: true
            }
        },
        series: [{
                name: 'High frequency',
                type: 'boxplot',
                color: "#234758",
                itemStyle: {
                    borderWidth: 1
                },
                data: seg.map(d => d.box)
            },
            {
                name: 'outlier',
                type: 'scatter',
                color: "#234758",
                symbolSize: 8,
                data: flatten(seg.map(d => d.seg))
            }
        ]
    }
}

const getPoincareChart = sa => {

    let data = sa.cardioCycles.map(c => Number.parseFloat((last(c).end - first(c).start).toFixed(4)))
    let values = []

    for (let i = 0; i < data.length - 1; i++) {
        values.push([data[i], data[i + 1]])
    }

    let min_ = min(data)
    let max_ = max(data)

    min_ = min_ - 0.5 * (max_ - min_)
    max_ = Number.parseFloat((max_ + 0.5 * (max_ - min_)).toFixed(4))

    min_ = 0

    return {
        grid: {
            width: 300,
            height: 300,
            left: "center",
            top: "center"
        },
        xAxis: {
            name: "Duration of Preceding Cardio Cycle, s",
            nameLocation: "center",
            nameTextStyle: {
                fontWeight: "bold"
            },
            nameGap: 25,
            min: min_,
            max: max_,
        },
        yAxis: {
            name: "Duration of Next Cardio Cycle, s",
            nameLocation: "center",
            nameTextStyle: {
                fontWeight: "bold"
            },
            nameGap: 35,
            min: min_,
            max: max_,
        },
        series: [{
            symbolSize: 6,
            color: "#234758",
            data: values,
            type: 'scatter',
        }]
    }
}

const getMurmurPolygons = sa => {

    let items = sa.segmentation.polygons
    items = items.map(d => {
        // let p = Polygon.array2Polygons(d.polygons)
        let merged = Polygon.getPatternForPolygons(d.shapes)
        return {
            name: d.name,
            // consistency: merged.consistency,
            timeBoundary: sortBy(d.shapes.map(v => {
                let b = Polygon.getPointArray([v]).map(v => v.x)
                return [
                    Number.parseFloat(min(b).toFixed(3)),
                    Number.parseFloat(max(b).toFixed(3))
                ]
            }), d => d[0]),

            svg: Polygon.getSVG(merged),
            // metric: merged.metric
        }
    })

    items = items.map(d => {

        d.count = d.timeBoundary.length

        d.segments = d.timeBoundary.map(t => ({
            type: d.name,
            start: t[0],
            end: t[1]
        }))

        return d
    })

    return items

}


const getSegmentationAnalysis = segmentation => {

    let s = JSON.parse(JSON.stringify(segmentation))

    let sa = {
        segmentation: parse(s)
    }

    sa = getSystoleDiastole(sa)
    sa = getTotals(sa)

    let murmurPolygons = getMurmurPolygons(sa)

    sa.segmentation.segments = sa.segmentation.segments.concat(
        flatten(murmurPolygons.map(p => p.segments))
    )

    sa.charts = {
        murmurPolygons,
        segmentation: getSegmentationChart(sa),
        segmentDurationBoxplot: getSegmentDurationBoxplot(sa),
        systoleDiastoleBars: getSystoleDiastoleBars(sa),
        hfBoxplot: getHFBoxplot(sa),
        systoleDiastoleScatterPlot: getSystoleDiastoleScatterPlot(sa),
        poincareChart: getPoincareChart(sa),

    }

    return sa
}







/////////////////////////////////////////////////////////////////////////////////////////////////////

const TOLERANCE = {
    segment:{
        "S1": [0.03, 0.03, Infinity, Infinity],
        "S2": [0.03, 0.03, Infinity, Infinity],
        "S3": [0.02, 0.02, Infinity, 20],
        "S4": [0.02, 0.02, Infinity, 20],
        "unsegmentable": [0.03, 0.03, Infinity, Infinity],
        "Inhale": [0.5, 0.5, Infinity, Infinity],
        "systole": [Infinity, Infinity, Infinity, Infinity],
        "diastole": [Infinity, Infinity, Infinity, Infinity],
    },

    polygon: 0.975

}

const mergeIntervals = (...intervals) =>  {
    let pool = sortBy(flatten(intervals), d=> d.start)
    let i = 0
    while (i < pool.length - 1) {
        if (pool[i].end >= pool[i + 1].start) {
            pool[i].end = pool[i + 1].end
            pool.splice(i + 1, 1)
        } else {
            i++
        }
    }

    return pool
}


const reduceEquality = (set1, set2, finder, key) => {
    
    set1 = set1.map( v => v)
    set2 = set2.map( v => v)


    let i = 0
    while (i < set1.length) {
        
        let index = finder(set1[i], set2, key)
        // console.log(index, set1[i], set2[index])
        if (index > -1) {
            set1.splice(i, 1)
            set2.splice(index, 1)
        } else {
            i++
        }
    
    }

    return set1.concat(set2)

}



///////////////////////////////////// segments difference/////////////////////////////////////////////

const findEqualSegmentIndex = (sample, sequence, type) => {
    return findIndex(sequence, s => [
            Math.abs(sample.start - s.start),
            Math.abs(sample.end - s.end),
            Math.abs(sample.lf - s.lf),
            Math.abs(sample.hf - s.hf)
        ]
        .map((v, index) => v <= TOLERANCE.segment[type][index])
        .reduce((a, b) => a && b, true)
    )
}

const getPairSegmentsDiff = (s1, s2) => {

    let matchData = CHECKED_SEGMENT_TYPES.map(type => ({
        s1: s1.filter(d => d.type == type),
        s2: s2.filter(d => d.type == type),
    }))

    let diff = []
    
    matchData = zipObject(CHECKED_SEGMENT_TYPES, matchData)

    keys(matchData).forEach(key => {

        let m = matchData[key]
        diff.push(reduceEquality(m.s1, m.s2, findEqualSegmentIndex, key))

    })

    let segments = zipObject(CHECKED_SEGMENT_TYPES, diff)

    return segments

}


const getNonConsistencyIntervalsForSegments = diffs => {

    diffs = (isArray(diffs || [])) ? diffs : [diffs]

    let pool = []
    diffs.forEach(d => {
        pool = pool.concat(flattenDeep(values(d)))
    })

    pool = sortBy(
        uniqWith(
            pool.map(d => ({
                start: Math.round(d.start-1),
                end: Math.round(d.end + 1)
            })),
            isEqual
        ),
        d => d.start
    )

    return mergeIntervals(pool)

}



const mergeSegment = segments => [
    mean(segments.map(s => s.start)).toFixed(3),
    mean(segments.map(s => s.end)).toFixed(3),
    mean(segments.map(s => s.lf)).toFixed(3),
    mean(segments.map(s => s.hf)).toFixed(3)
]


const getSegmentsDiff = segmentations => {

    segmentations = (isArray(segmentations || [])) ? segmentations : [segmentations]
    
    let res = []

    for (let i = 0; i < segmentations.length - 1; i++) {
        res.push(getPairSegmentsDiff(segmentations[i], segmentations[i + 1]))
    }

    return res

}


const mergeSegments = segmentations => {

    segmentations = (isArray(segmentations || [])) ? segmentations : [segmentations]
    
    // segmentations = segmentations.map(s => parse(s))

    let differences = getSegmentsDiff(segmentations)

    if (getNonConsistencyIntervalsForSegments(differences).length > 0) return

    let mergeData = SEGMENT_TYPES.map(
        type => segmentations.map(
            seg => seg.filter(d => d.type == type)
        )
    )

    mergeData = mergeData.map(d => d[0].map((t, index) => d.map(v => v[index])))

    mergeData = mergeData.map(d => d.map(s => mergeSegment(s)))

    return extend({ v2: true }, zipObject(SEGMENT_TYPES, mergeData))

}

///////////////////////////////////////// polygons differences //////////////////////////////////////

// const findEqualPolygonIndex = (pattern, sequence) =>
//     let consistencies = sequence.map( p => {
//         return (Polygon.getIntersection([pattern, p]).area() / Polygon.getUnion([pattern, p]).area()) >= TOLERANCE.polygon
//     })
//     return findIndex(consistencies, c => c)
// }

const findEqualPolygonIndex = (pattern, sequence) => {
    
    let logPattern = Polygon.create(Polygon.getPointArray([pattern]).map( d => [d.x, Math.log(d.y)]))
    let consistencies = sequence.map( p => {

        let logP = Polygon.create(Polygon.getPointArray([p]).map( d => [d.x, Math.log(d.y)]))
        return (Polygon.getIntersection([logPattern, logP]).area() / Polygon.getUnion([logPattern, logP]).area()) >= TOLERANCE.polygon
    })
    return findIndex(consistencies, c => c)
}


const getPairPolygonDiff = (polygonSet1, polygonSet2) => {
    return reduceEquality(polygonSet1, polygonSet2, findEqualPolygonIndex)
}

const getNonConsistencyIntervalsForPolygons = diffs => {

    diffs = (isArray(diffs || [])) ? diffs : [diffs]

    let pool = flatten(diffs)

    pool = sortBy(
        uniqWith(
            pool.map(d => ({
                start: Math.round(d.box.xmin - 1),
                end: Math.round(d.box.xmax + 1)
            })),
            isEqual
        ),
        d => d.start
    )

    return mergeIntervals(pool)

}

const getPolygonsDiff = (...poligonSets) => {

    poligonSets = (isArray(poligonSets || [])) ? poligonSets : [poligonSets]
    
    let res = []

    for (let i = 0; i < poligonSets.length - 1; i++) {
        res.push(getPairPolygonDiff(poligonSets[i], poligonSets[i + 1]))
    }

    return flatten(res)

}

const mergePolygons = (...polygonSets) => {

    polygonSets = (isArray(polygonSets || [])) ? polygonSets : [polygonSets]
    
    let differences = getPolygonsDiff (polygonSets)

    if (getNonConsistencyIntervalsForPolygons(differences).length > 0) return

    let mergeData = polygonSets[0].map( (p, index) => {
        return Polygon.simplify(Polygon.merge(polygonSets.map( v => v[index])))
    })

    return mergeData
}


/////////////////////////////////////////////////////////////////////////////////////////////////////

module.exports = {
    parse,
    getSegmentationChart,
    getMultiSegmentationChart,
    getPairSegmentsDiff,
    getSegmentsDiff,
    getNonConsistencyIntervalsForSegments,
    mergeSegments,
    getSegmentationAnalysis
}

/////////////////////////////////////////////////////////////////////////////////////////////


// let s1 =  {
//     "v2": true,
//     "S1": [
//       [
//         "0.645",
//         "0.749",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "1.227",
//         "1.335",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "1.887",
//         "1.989",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "2.514",
//         "2.613",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "3.263",
//         "3.365",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "4.185",
//         "4.295",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "4.808",
//         "4.912",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "5.343",
//         "5.445",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "5.939",
//         "6.041",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "6.729",
//         "6.834",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "7.437",
//         "7.539",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "8.354",
//         "8.465",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "9.292",
//         "9.393",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "10.130",
//         "10.229",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "10.953",
//         "11.057",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "11.591",
//         "11.687",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "12.472",
//         "12.571",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "13.191",
//         "13.300",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "13.854",
//         "13.954",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "14.749",
//         "14.852",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "15.595",
//         "15.694",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "16.271",
//         "16.374",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "17.090",
//         "17.194",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "17.855",
//         "17.953",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "18.576",
//         "18.673",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "19.210",
//         "19.305",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "19.825",
//         "19.923",
//         "0.000",
//         "22050.000"
//       ]
//     ],
//     "S2": [
//       [
//         "0.897",
//         "0.979",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "0.017",
//         "0.107",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "1.494",
//         "1.586",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "2.145",
//         "2.234",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "2.776",
//         "2.870",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "3.531",
//         "3.624",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "4.450",
//         "4.544",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "5.076",
//         "5.152",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "5.603",
//         "5.681",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "6.204",
//         "6.274",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "6.967",
//         "7.051",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "7.685",
//         "7.771",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "8.609",
//         "8.704",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "9.537",
//         "9.626",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "10.381",
//         "10.457",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "11.202",
//         "11.291",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "11.849",
//         "11.939",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "12.730",
//         "12.811",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "13.483",
//         "13.570",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "14.128",
//         "14.215",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "15.002",
//         "15.079",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "15.845",
//         "15.927",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "16.540",
//         "16.615",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "17.358",
//         "17.439",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "18.126",
//         "18.209",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "18.831",
//         "18.912",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "19.473",
//         "19.553",
//         "0.000",
//         "22050.000"
//       ]
//     ],
//     "Murmur": [
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             13.954619420857254,
//             20
//           ],
//           [
//             14.12793013115543,
//             20
//           ],
//           [
//             14.12793013115543,
//             651.4232135668533
//           ],
//           [
//             13.954619420857254,
//             651.4232135668533
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             13.301274779901899,
//             20
//           ],
//           [
//             13.481985292788861,
//             20
//           ],
//           [
//             13.481985292788861,
//             576.7925243600912
//           ],
//           [
//             13.301274779901899,
//             576.7925243600912
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             12.572930013476649,
//             20
//           ],
//           [
//             12.728285204645346,
//             20
//           ],
//           [
//             12.728285204645346,
//             551.0578039439663
//           ],
//           [
//             12.572930013476649,
//             551.0578039439663
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             11.687850125744434,
//             31.216451538244655
//           ],
//           [
//             11.847815721841608,
//             31.216451538244655
//           ],
//           [
//             11.847815721841608,
//             584.5129404849285
//           ],
//           [
//             11.687850125744434,
//             584.5129404849285
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             10.230134813255338,
//             20
//           ],
//           [
//             10.38006776585768,
//             20
//           ],
//           [
//             10.38006776585768,
//             653.1746119907925
//           ],
//           [
//             10.230134813255338,
//             653.1746119907925
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             9.395218300374824,
//             20
//           ],
//           [
//             9.535467835528435,
//             20
//           ],
//           [
//             9.535467835528435,
//             537.5187678349482
//           ],
//           [
//             9.395218300374824,
//             537.5187678349482
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             8.469119227046798,
//             20
//           ],
//           [
//             8.607680148377156,
//             20
//           ],
//           [
//             8.607680148377156,
//             565.7901964063769
//           ],
//           [
//             8.469119227046798,
//             565.7901964063769
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             7.539355048908541,
//             20
//           ],
//           [
//             7.683879558679512,
//             20
//           ],
//           [
//             7.683879558679512,
//             601.7720145881951
//           ],
//           [
//             7.539355048908541,
//             601.7720145881951
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             6.836000201655538,
//             36.343443159623575
//           ],
//           [
//             6.965997433018954,
//             36.343443159623575
//           ],
//           [
//             6.965997433018954,
//             568.3603262765068
//           ],
//           [
//             6.836000201655538,
//             568.3603262765068
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             6.0442631929917905,
//             20
//           ],
//           [
//             6.202284218349307,
//             20
//           ],
//           [
//             6.202284218349307,
//             586.3512353674159
//           ],
//           [
//             6.0442631929917905,
//             586.3512353674159
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             5.447896996979841,
//             20
//           ],
//           [
//             5.600519007074424,
//             20
//           ],
//           [
//             5.600519007074424,
//             648.0343522505327
//           ],
//           [
//             5.447896996979841,
//             648.0343522505327
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             4.914051555844572,
//             17.429870129870324
//           ],
//           [
//             5.074289556018392,
//             17.429870129870324
//           ],
//           [
//             5.074289556018392,
//             619.7629236791042
//           ],
//           [
//             4.914051555844572,
//             619.7629236791042
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             4.30008214211406,
//             31.203183419363995
//           ],
//           [
//             4.447424713936456,
//             31.203183419363995
//           ],
//           [
//             4.447424713936456,
//             514.3875990037795
//           ],
//           [
//             4.30008214211406,
//             514.3875990037795
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             3.3668307777926056,
//             31.203183419363995
//           ],
//           [
//             3.5279847985592836,
//             31.203183419363995
//           ],
//           [
//             3.5279847985592836,
//             581.2109756271561
//           ],
//           [
//             3.3668307777926056,
//             581.2109756271561
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             2.614080974702069,
//             36.343443159623575
//           ],
//           [
//             2.7744250107303086,
//             36.343443159623575
//           ],
//           [
//             2.7744250107303086,
//             558.0798067959872
//           ],
//           [
//             2.614080974702069,
//             558.0798067959872
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             1.991204365533028,
//             20
//           ],
//           [
//             2.1440893022047858,
//             20
//           ],
//           [
//             2.1440893022047858,
//             542.659027575208
//           ],
//           [
//             1.991204365533028,
//             542.659027575208
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             1.3385569868555283,
//             20
//           ],
//           [
//             1.4909640036495222,
//             20
//           ],
//           [
//             1.4909640036495222,
//             519.5278587440391
//           ],
//           [
//             1.3385569868555283,
//             519.5278587440391
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             0.7511229660097336,
//             20
//           ],
//           [
//             0.8945997585441111,
//             20
//           ],
//           [
//             0.8945997585441111,
//             617.1927938089743
//           ],
//           [
//             0.7511229660097336,
//             617.1927938089743
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             14.854252214444836,
//             20
//           ],
//           [
//             14.999454724777381,
//             20
//           ],
//           [
//             14.999454724777381,
//             578.6408457570262
//           ],
//           [
//             14.854252214444836,
//             578.6408457570262
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             15.695982581041088,
//             31.203183419363995
//           ],
//           [
//             15.841889408299183,
//             31.203183419363995
//           ],
//           [
//             15.841889408299183,
//             447.56422238040295
//           ],
//           [
//             15.695982581041088,
//             447.56422238040295
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             16.37570696904792,
//             20
//           ],
//           [
//             16.53782803558734,
//             20
//           ],
//           [
//             16.53782803558734,
//             488.68630030248073
//           ],
//           [
//             16.37570696904792,
//             488.68630030248073
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             17.19612013588709,
//             20
//           ],
//           [
//             17.356185044971163,
//             20
//           ],
//           [
//             17.356185044971163,
//             496.39668991287044
//           ],
//           [
//             17.19612013588709,
//             496.39668991287044
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             17.954326623688633,
//             20
//           ],
//           [
//             18.12315226896408,
//             20
//           ],
//           [
//             18.12315226896408,
//             565.7901964063769
//           ],
//           [
//             17.954326623688633,
//             565.7901964063769
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             18.675644603576995,
//             20
//           ],
//           [
//             18.829114469710127,
//             20
//           ],
//           [
//             18.829114469710127,
//             555.5096769258573
//           ],
//           [
//             18.675644603576995,
//             555.5096769258573
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       },
//       {
//         "name": "Murmur",
//         "type": "annotation-polygon",
//         "points": [
//           [
//             19.307490592828437,
//             20
//           ],
//           [
//             19.47258039078924,
//             20
//           ],
//           [
//             19.47258039078924,
//             555.5096769258573
//           ],
//           [
//             19.307490592828437,
//             555.5096769258573
//           ]
//         ],
//         "additionalNames": [],
//         "alternativeNames": [
//           "Murmur",
//           "Murmur"
//         ]
//       }
//     ],
//     "Inhale": [
//       [
//         "1.821",
//         "3.009",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "6.711",
//         "8.747",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "10.791",
//         "12.861",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "16.688",
//         "18.310",
//         "0.000",
//         "22050.000"
//       ]
//     ],
//     "unsegmentable": [
//       [
//         "0.000",
//         "0.017",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "19.923",
//         "19.968",
//         "0.000",
//         "22050.000"
//       ]
//     ],
//     "diastole": [
//       [
//         "0.107",
//         "0.645",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "0.979",
//         "1.227",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "1.586",
//         "1.887",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "2.234",
//         "2.514",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "2.870",
//         "3.263",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "3.624",
//         "4.185",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "4.544",
//         "4.808",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "5.152",
//         "5.343",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "5.681",
//         "5.939",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "6.274",
//         "6.729",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "7.051",
//         "7.437",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "7.771",
//         "8.354",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "8.704",
//         "9.292",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "9.626",
//         "10.130",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "10.457",
//         "10.953",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "11.291",
//         "11.591",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "11.939",
//         "12.472",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "12.811",
//         "13.191",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "13.570",
//         "13.854",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "14.215",
//         "14.749",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "15.079",
//         "15.595",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "15.927",
//         "16.271",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "16.615",
//         "17.090",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "17.439",
//         "17.855",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "18.209",
//         "18.576",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "18.912",
//         "19.210",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "19.553",
//         "19.825",
//         "0.000",
//         "22050.000"
//       ]
//     ],
//     "systole": [
//       [
//         "0.749",
//         "0.897",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "1.335",
//         "1.494",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "1.989",
//         "2.145",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "2.613",
//         "2.776",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "3.365",
//         "3.531",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "4.295",
//         "4.450",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "4.912",
//         "5.076",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "5.445",
//         "5.603",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "6.041",
//         "6.204",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "6.834",
//         "6.967",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "7.539",
//         "7.685",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "8.465",
//         "8.609",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "9.393",
//         "9.537",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "10.229",
//         "10.381",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "11.057",
//         "11.202",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "11.687",
//         "11.849",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "12.571",
//         "12.730",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "13.300",
//         "13.483",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "13.954",
//         "14.128",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "14.852",
//         "15.002",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "15.694",
//         "15.845",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "16.374",
//         "16.540",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "17.194",
//         "17.358",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "17.953",
//         "18.126",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "18.673",
//         "18.831",
//         "0.000",
//         "22050.000"
//       ],
//       [
//         "19.305",
//         "19.473",
//         "0.000",
//         "22050.000"
//       ]
//     ]
//   }



//   let s2 = JSON.parse(JSON.stringify(s1))

//   s2.S1[0] = [
//         "0.000",
//         "0.749",
//         "0.000",
//         "22050.000"
//       ]

//   s2.Murmur[0].points = [
//           [
//             13.954619420857254,
//             20
//           ],
//           [
//             14.12793013115543,
//             20
//           ],
//           [
//             14.12793013115543,
//             651.4232135668533
//           ],
//           [
//             13.961, //4619420857254,
//             651.4232135668533
//           ]
//         ]


//   s1 = parse(s1)

//   s2 = parse(s2)
  


//   // console.log(s1.polygons[0].shapes.length, s2.polygons[0].shapes.length)

//   // console.log(findEqualPolygonIndex(s1.polygons[0].shapes[5], s1.polygons[0].shapes))

//   let shapes1 = s1.polygons[0].shapes //sortBy(s1.polygons[0].shapes, v => v.box.xmin)
//   let shapes2 = s2.polygons[0].shapes //sortBy(s1.polygons[0].shapes, v => v.box.xmin)
      

//   console.log("!!!!!!!!!!!!!!!!!!")
//   let data = getPolygonsDiff(shapes1, shapes2)
//   console.log(data.map(d => Polygon.getPointArray([d]))) //JSON.stringify(d.box)).join("\n"))
//   // let int = getNonConsistencyIntervalsForPolygons(data)
//   // console.log(int)
//   // int = mergeIntervals(int, [{start:8, end:10}])
//   // console.log(int)


//   // console.log(
//   //       mergeIntervals( int, 
//   //           getNonConsistencyIntervalsForSegments(
//   //               getSegmentsDiff([s1.segments, s2.segments])
//   //           )
//   //       )    
//   // )


    
//     // let m = mergePolygons(shapes1, shapes2)

//     // shapes1.forEach((p,index) => {
//     //     console.log(Polygon.getPointArray([p]), Polygon.getPointArray([shapes2[index]]), Polygon.getPointArray([m[index]]))
//     // })
//     // 