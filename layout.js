function layout (element) {
  if (!element.computedStyle) {
    return
  }

  let elementStyle = getStyle(element)
  if (elementStyle.display !== 'flex') {
    return
  }

  let items = element.children.filter(e => e.type === 'element')
  // TODO: 这里为啥还要排序呢？
  items.sort((a, b) => {
    return (a.order || 0) - (b.order || 0)
  })

  let mainSize, mainStart, mainEnd, mainSign, mainBase,
    crossSize, crossStart, crossEnd, crossSign, crossBase
  if (elementStyle.flexDirection === 'row') {
    mainSize = 'width'
    mainStart = 'left'
    mainEnd = 'right'
    mainSign = +1
    mainBase = 0

    crossSize = 'height'
    crossStart = 'top'
    crossEnd = 'bottom'
  }

  if (elementStyle.flexDirection === 'row-reverse') {
    mainSize = 'width'
    mainStart = 'right'
    mainEnd = 'left'
    mainSign = -1
    mainBase = style.width

    crossSize = 'height'
    crossStart = 'top'
    crossEnd = 'bottom'
  }
  if (elementStyle.flexDirection === 'column') {
    mainSize = 'height';
    mainStart = 'top';
    mainEnd = 'bottom';
    mainSign = +1;
    mainBase = 0;

    crossSize = 'width';
    crossStart = 'left';
    crossEnd = 'right';
  }

  if (elementStyle.flexDirection === 'column-reverse') {
    mainSize = 'height';
    mainStart = 'bottom';
    mainEnd = 'top';
    mainSign = +1;
    mainBase = elementStyle.height;

    crossSize = 'width';
    crossStart = 'left';
    crossEnd = 'right';
  }
  // 这个属性是改变交叉轴 cross的方向
  if (elementStyle.flexWrap === 'wrap-reverse') {
    let tmp = crossStart;
    crossStart = crossEnd;
    crossEnd = tmp;
    crossSign = -1;
  } else {
    crossBase = 0;
    crossSign = 1;
  }
  // 计算分行
  let isAutoMainSize = false
  if (!elementStyle[mainSize]) { // auto sizing 如果父元素没写mainSize
    elementStyle[mainSize] = 0
    // 父元素等于子元素相加
    for (let i = 0; i < items.length; i++) {
      let item = items[i]
      let itemStyle = getStyle(item)
      if (itemStyle[mainSize] !== undefined && itemStyle[mainSize] !== 'auto') {
        elementStyle[mainSize] = elementStyle[mainSize] + itemStyle[mainSize]
      }
    }
    isAutoMainSize = true
  }

}

module.exports.layout = layout