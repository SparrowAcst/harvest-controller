
const isBuffer = obj => obj &&
    obj.constructor &&
    (typeof obj.constructor.isBuffer === 'function') &&
    obj.constructor.isBuffer(obj)


const keyIdentity  = key => key

const flatten  = (target, opts) => {
  opts = opts || {}

  const delimiter = opts.delimiter || '.'
  const maxDepth = opts.maxDepth
  const transformKey = opts.transformKey || keyIdentity
  const output = {}

  const step = (object, prev, currentDepth) => {
    currentDepth = currentDepth || 1
    Object.keys(object).forEach( key => {
      const value = object[key]
      const isarray = opts.safe && Array.isArray(value)
      const type = Object.prototype.toString.call(value)
      const isbuffer = isBuffer(value)
      const isobject = (
        type === '[object Object]' ||
        type === '[object Array]'
      )
      const isfunction = type === '[object Function]'

      console.log(key, type, isfunction, isobject, isarray, isbuffer)

      const newKey = prev
        ? prev + delimiter + transformKey(key)
        : transformKey(key)

      if (!isarray && !isbuffer && isobject && Object.keys(value).length &&
        (!opts.maxDepth || currentDepth < maxDepth)) {
        return step(value, newKey, currentDepth + 1)
      }

      output[newKey+(isfunction ? '$fn' : '')] = isfunction ? value.toString() : value 
    })
  }

  step(target)

  return output
}

const unflatten  = (target, opts) => {
  opts = opts || {}

  const delimiter = opts.delimiter || '.'
  const overwrite = opts.overwrite || false
  const transformKey = opts.transformKey || keyIdentity
  const result = {}

  const isbuffer = isBuffer(target)
  if (isbuffer || Object.prototype.toString.call(target) !== '[object Object]') {
    return target
  }

  // safely ensure that the key is
  // an integer.
  const getkey  = key => {
    const parsedKey = Number(key)

    return (
      isNaN(parsedKey) ||
      key.indexOf('.') !== -1 ||
      opts.object
    )
      ? key
      : parsedKey
  }

  const addKeys = (keyPrefix, recipient, target) => {
    return Object.keys(target).reduce((result, key) => {
      let k = key
      k = (k.endsWith("$fn")) ? k.slice(0,-3) : k
      let v
      try {
        v = (key.endsWith("$fn")) ? eval(target[key]) : target[key]
      } catch(e) {
        v = `${target[key]}\n${e.toString()}\n${e.stack}`
      }

      result[keyPrefix + delimiter + k] = v 

      return result
    }, recipient)
  }

  const isEmpty = (val) => {
    const type = Object.prototype.toString.call(val)
    const isArray = type === '[object Array]'
    const isObject = type === '[object Object]'

    if (!val) {
      return true
    } else if (isArray) {
      return !val.length
    } else if (isObject) {
      return !Object.keys(val).length
    }
  }

  target = Object.keys(target).reduce((result, key) => {
    const type = Object.prototype.toString.call(target[key])
    const isObject = (type === '[object Object]' || type === '[object Array]')
    if (!isObject || isEmpty(target[key])) {
      let k = key
      k = (k.endsWith("$fn")) ? k.slice(0,-3) : k
      let v
      try {
        v = (key.endsWith("$fn")) ? eval(target[key]) : target[key]
      } catch(e) {
        v = `${target[key]}\n${e.toString()}\n${e.stack}`
      }

      result[k] = v
      return result
    } else {
      return addKeys(
        key,
        result,
        flatten(target[key], opts)
      )
    }
  }, {})

  Object.keys(target).forEach( key => {
    const split = key.split(delimiter).map(transformKey)
    let key1 = getkey(split.shift())
    let key2 = getkey(split[0])
    let recipient = result

    while (key2 !== undefined) {
      if (key1 === '__proto__') {
        return
      }

      const type = Object.prototype.toString.call(recipient[key1])
      const isobject = (
        type === '[object Object]' ||
        type === '[object Array]'
      )

      // do not write over falsey, non-undefined values if overwrite is false
      if (!overwrite && !isobject && typeof recipient[key1] !== 'undefined') {
        return
      }

      if ((overwrite && !isobject) || (!overwrite && recipient[key1] == null)) {
        recipient[key1] = (
          typeof key2 === 'number' &&
          !opts.object
            ? []
            : {}
        )
      }

      recipient = recipient[key1]
      if (split.length > 0) {
        key1 = getkey(split.shift())
        key2 = getkey(split[0])
      }
    }

    // unflatten again for 'messy objects'
    recipient[key1] = unflatten(target[key], opts)
  })

  return result
}

module.exports = {
  flattenObject: flatten,
  unflattenObject: unflatten
}

