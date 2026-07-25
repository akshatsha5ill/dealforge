import xss from 'xss';

const myXss = new xss.FilterXSS({
  whiteList: {}, // empty, means filter out all tags
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script'] // the script tag is a special case, we need to filter out its content
});

export const sanitizeObject = (obj: any): any => {
  if (typeof obj === 'string') {
    return myXss.process(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
};
