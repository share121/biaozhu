
(() => {
    "use strict"

    // Parameters
    const saveInterval = 3 // 自动保存缓存的时间间隔，单位：秒
    const fontBaseSize = 25 // Text size in pixels
	
	const tipfontcolor = "#000000"
	const bboxalpha = 0.1
    const markedFontColor = "#FF4136" // Marked bbox font color
    const markedBorderColor = "#FF4136" // Marked bbox border color
    const markedBackgroundColor = "rgba(255, 133, 27, 0.1)" // Marked bbox fill color
    const minBBoxWidth = 5 // Minimal width of bbox
    const minBBoxHeight = 5 // Minimal height of bbox
    const scrollSpeed = 1.1 // Multiplying factor of wheel speed
    const minZoom = 0.1 // Smallest zoom allowed
    const maxZoom = 5 // Largest zoom allowed
    const edgeSize = 5 // Resize activation area in pixels
    const resetCanvasOnChange = true // Whether to return to default position and zoom on image change
    const defaultScale = 0.5 // Default zoom level for images. Can be overridden with fittedZoom
    const drawCenterX = true // Whether to draw a cross in the middle of bbox
    const drawGuidelines = true // Whether to draw guidelines for cursor
    const fittedZoom = true // Whether to fit image in the screen by it's largest dimension. Overrides defaultScale
	let canclick_bboxinfo = {}//等待点击的bbox信息，例如{"imagename": currentImage.name, "classname:" classname, "index:" i}
	
	const label_foldername = "labels"
	const images_foldername = "images"
	const imagesbboxes_foldername = "images_with_bboxes"
	const imagescrop_foldername = "crop_images"
	
	const bbox_path = ""
	let task = "detection"//detection or classification
	
	const crop_path_first = "class"//1、name：路径为foldername\imagename\；2、class：路径为foldername\class\；3、no：路径为foldername\
    // Main containers
    let canvas = new Canvas("canvas", document.getElementById("right").clientWidth, window.innerHeight - 20)
	let canvaswidth = canvas.width
	
    let images = {}
    let classes = {}
    let bboxes = {}
	let colors = {}
	let ignore_class = []//恢复本地标注文件时，可能会遇到一些未添加类，此时提示是否添加，如否则加入ignore_class，以后遇到不会再提醒
	let ignore_image = []//恢复本地标注文件时，可能会遇到一些未添加图片，将其加入ignore_image，以后遇到不会再提醒

    const extensions = ["jpg", "jpeg", "png", "JPG", "JPEG", "PNG"]

    let currentImage = null
    let currentClass = null
    let currentBbox = null
    let imageListIndex = -1
    let classListIndex = -1

    // Scaling containers
    let scale = defaultScale
    let canvasX = 0
    let canvasY = 0
    let screenX = 0
    let screenY = 0

    // Mouse container
    const mouse = {
        x: 0,
        y: 0,
        realX: 0,
        realY: 0,
        buttonL: false,
        buttonR: false,
        startRealX: 0,
        startRealY: 0,
		state: "default"
    }

    // Prevent context menu on right click - it's used for panning
    document.addEventListener("contextmenu", function (e) {
        e.preventDefault()
    }, false)

    const isSupported = ()  => {
        try {
            const key = "__some_random_key_1234%(*^()^)___"

            localStorage.setItem(key, key)
            localStorage.removeItem(key)

            return true
        } catch (e) {
            return false
        }
    }
    
    // Start everything
    document.onreadystatechange = () => {
        if (document.readyState === "complete") {
            FreshCanvas()
            listenImageLoad()
            listenImageSelect()
            listenClassSelect()
            listenBboxLoad()
            listenKeyboard()
            listenImageSearch()
			listenaddclasses()
			listenmodifyclasses()
			listendeleteclasses()
			listenchangecolor()
			listenTask()//获取目前的task并监听变化
			showsave()
			listenCanvasMouse()
			listenLabelsSave()
			save_browser()//自动保存数据到本地缓存
        }
    }
	
	// 间隔一段时间缓存数据到本地浏览器
	const save_browser = () => {
		if (isSupported() === true) {
			setInterval(() => {
				if (Object.keys(bboxes).length > 0) {//有bboxes的时候才需要保存
					var savebboxes_browser = {
						imagenames : Object.keys(images),
						bboxes : bboxes,
						classes : classes,
						colors : colors,
						task : task
					}
					localStorage.setItem("savebboxes_browser", JSON.stringify(savebboxes_browser))
				}
			}, saveInterval * 1000)
		} else {
			//没必要提示
			//alert("Restore function is not supported. If you need it, use Chrome or Firefox instead.")
		}
	}
	
	const zip_out = (zip, flag, name) => {
		setTimeout(function(){
			var f = true
			for(var f1 in flag){
				if(flag[f1] == false){f = false}
			}
			if(f == true){
				zip.generateAsync({type: "blob"})
					.then((blob) => {
						saveAs(blob, name)
						document.body.style.cursor = "default"
					})
			}else{
				zip_out(zip, flag, name)
				}
		}, 300);
	}

	const FreshCanvas = () => {//注释了canvas.js的127行："Its Working!"
		const drawimage = (context) => {
			context.drawImage(currentImage.object, zoomX(0), zoomY(0), zoom(currentImage.width), zoom(currentImage.height))
		}
		
		const drawintro = (context) => {
			setFontStyles_unzoom(context, false, tipfontcolor, false)
			var text_intro = [
				"一、运行流程:",
				"1. 选择数据任务：图象分类 或 目标检测；",
				"2. 于“在此输入要添加的标签”内输入要添加的标签，并点击“导入（批量）图片”",
				"，单选或者多选图片导入；",
				"3. 如有本地标签文件，可以在导入图片后，点击“导入本地标签文件”；",
				"4. 对于图象分类任务，只需要点击相应的分类标签；而对于目标检测任务，则需要",
				"先点击相应的分类标签，再按着鼠标左键拖动，生成标注框；",
				"5. 标注完成后，勾选需要输出的内容，点击“导出数据”按钮下载标签数据。",
				"",
				"二、提示及备注:",
				"1. 本项目参考ybat实现：https://github.com/drainingsun/ybat/，其运行核心与",
				"ybat已大不同；",
				"2. 画布内，按鼠标中键可放大缩小；按鼠标右键移动画布位置（部分浏览器不支持）；",
				"3. 按左←右→键可以切换图片，按上↑下↓键可以切换默认标签，按delete键可以删",
				"除标注框；",
				"4. 本项目无任何后门，可放心使用；",
				"5. 本项目开发过程中使用chrome进行功能测试，因此推荐使用chrome谷歌浏览器",
				"6. 如出现bug，或有其他建议，请邮件联系：476003177@qq.com。",
			]

			for(var i = 0; i < text_intro.length; i ++){
				context.fillText(text_intro[i], zoomX(30), zoomY(60 + 60 * i))
			}	
		}
		
		const drawX = (context, x, y, width, height) => {
			if (drawCenterX === true) {
				const centerX = x + width / 2
				const centerY = y + height / 2
				context.beginPath()
				context.moveTo(zoomX(centerX), zoomY(centerY - 10))
				context.lineTo(zoomX(centerX), zoomY(centerY + 10))
				context.stroke()
				context.beginPath()
				context.moveTo(zoomX(centerX - 10), zoomY(centerY))
				context.lineTo(zoomX(centerX + 10), zoomY(centerY))
				context.stroke()
			}
		}
		
		const drawnewbbox = (context) => {
			if(mouse.state == "create"){
				var width = mouse.realX - mouse.startRealX
				var height = mouse.realY - mouse.startRealY
				setBBoxStyles(context, true, markedBorderColor, markedBackgroundColor)
				context.strokeRect(zoomX(mouse.startRealX), zoomY(mouse.startRealY), zoom(width), zoom(height))
				context.fillRect(zoomX(mouse.startRealX), zoomY(mouse.startRealY), zoom(width), zoom(height))
				drawX(context, mouse.startRealX, mouse.startRealY, width, height)
				setBboxCoordinates(mouse.startRealX, mouse.startRealY, width, height)
			}
		}
		
		const drawexistingbboxes = (context) => {
			const currentBboxes = bboxes[currentImage.name]
			for (let className in currentBboxes) {
				currentBboxes[className].forEach(bbox => {
					if(task == "classification"){
						setFontStyles_unzoom(context, bbox.marked, colors[className], true, fontBaseSize * 2)
						context.fillText(className, zoomX(bbox.width/2), zoomY(bbox.height / 2))
					}else{
						setFontStyles_unzoom(context, bbox.marked, colors[className], false)
						context.fillText(className, zoomX(bbox.x), zoomY(bbox.y - 2))
					}
					setBBoxStyles(context, bbox.marked, colors[className], rgbToRgba(colors[className], bboxalpha))
					context.strokeRect(zoomX(bbox.x), zoomY(bbox.y), zoom(bbox.width), zoom(bbox.height))
					context.fillRect(zoomX(bbox.x), zoomY(bbox.y), zoom(bbox.width), zoom(bbox.height))
					//drawX(context, bbox.x, bbox.y, bbox.width, bbox.height)
					if (bbox.marked === true) {
						setBboxCoordinates(bbox.x, bbox.y, bbox.width, bbox.height)
					}
				})
			}
		}
		
		const drawcross = (context) => {
			if (drawGuidelines === true) {
				context.setLineDash([5])
				context.beginPath()
				context.moveTo(zoomX(mouse.realX), zoomY(0))
				context.lineTo(zoomX(mouse.realX), zoomY(currentImage.height))
				context.stroke()
				context.beginPath()
				context.moveTo(zoomX(0), zoomY(mouse.realY))
				context.lineTo(zoomX(currentImage.width), zoomY(mouse.realY))
				context.stroke()
			}
		}
		
		if(window.innerHeight - 20 != canvas.height){canvas = new Canvas("canvas", document.getElementById("right").clientWidth, window.innerHeight - 20)}
		var context = canvas["element"].getContext("2d")
		context.clear()
		if (currentImage !== null) {
			drawimage(context)
			drawnewbbox(context)
			drawexistingbboxes(context)
			drawcross(context)
		} else {
			drawintro(context)
		}
    }

    const setBBoxStyles = (context, marked, bordercolor_this, backgroundcolor_this) => {
        context.setLineDash([])
        if (marked === true) {
            context.strokeStyle = markedBorderColor
            context.fillStyle = markedBackgroundColor
        } else {
			context.strokeStyle = bordercolor_this
            context.fillStyle = backgroundcolor_this
        }
    }

    const setBboxCoordinates = (x, y, width, height) => {//设置bbox信息框信息
        const x2 = x + width
        const y2 = y + height

        document.getElementById("bboxInformation").innerHTML = `${width}x${height} (${x}, ${y}) (${x2}, ${y2})`
    }

    const setFontStyles_unzoom = (context, marked, fontcolor_this, center, fontsize) => {
		var fontsize = fontsize ? fontsize : fontBaseSize
		if(center == true){context.textAlign = "center"}
        if (marked === true) {
            context.fillStyle = markedFontColor
        } else {
			context.fillStyle = fontcolor_this
        }

        //context.font = context.font.replace(/\d+px/, `${zoom(fontBaseSize)}px`)
		context.font = context.font.replace(/\d+px/, `${fontsize}px`)
    }
	
	const setFontStyles_dezoom = (context, marked, fontcolor_this, center, fontsize) => {
		var fontsize = fontsize ? fontsize : fontBaseSize
        if(center == true){context.textAlign = "center"}
		if (marked === true) {
			context.fillStyle = markedFontColor
        } else {
            context.fillStyle = fontcolor_this
        }
		fontsize = Math.floor(fontsize * 1.5 / scale)
		context.font = context.font.replace(/\d+px/, `${fontsize}px`)
    }
	
    const listenCanvasMouse = () => {
		if(task == "detection"){
			canvas.element.addEventListener("wheel", trackWheel, {passive: false})
			canvas.element.addEventListener("mousemove", trackPointer)
			canvas.element.addEventListener("mousedown", trackPointer)
			canvas.element.addEventListener("mouseup", trackPointer)
			canvas.element.addEventListener("mouseout", trackPointer)
		}else if(task == "classification"){
			canvas.element.removeEventListener("mousemove", trackPointer, false)
			canvas.element.removeEventListener("mousedown", trackPointer, false)
			canvas.element.removeEventListener("mouseup", trackPointer, false)
			canvas.element.removeEventListener("mouseout", trackPointer, false)
		}
    }

    const trackWheel = (event) => {
        if (event.deltaY < 0) {
            scale = Math.min(maxZoom, scale * scrollSpeed)
        } else {
            scale = Math.max(minZoom, scale * (1 / scrollSpeed))
        }

        canvasX = mouse.realX
        canvasY = mouse.realY
        screenX = mouse.x
        screenY = mouse.y

        mouse.realX = zoomXInv(mouse.x)
        mouse.realY = zoomYInv(mouse.y)

        event.preventDefault()
		FreshCanvas()
    }
	
	const storeNewBbox = (point, x, y, width, height, marked, classname, imagename) => {
		var bbox = {
			point: point,
            x: parseInt(x),
            y: parseInt(y),
            width: parseInt(width),
            height: parseInt(height),
            marked: marked,
            class: classname,
        }
		//该图片没有任何标注框
        if (typeof(bboxes[imagename]) === "undefined") {
            bboxes[imagename] = {}
        }
		//该图片该类没有任何标注框
        if (typeof(bboxes[imagename][classname]) === "undefined") {
            bboxes[imagename][classname] = []
        }
        bboxes[imagename][classname].push(bbox)
		return bbox
	}
	
    const storeNewBbox_squre = (movedWidth, movedHeight, startx, starty, imagename, classname, setcurrent) => {
		//设置默认值
		var startx = (typeof(startx) == "number") ? startx : Math.min(mouse.startRealX, mouse.realX)
		var starty = (typeof(starty) == "number") ? starty : Math.min(mouse.startRealY, mouse.realY)
		var imagename = imagename ? imagename : currentImage.name
		var classname = classname ? classname : currentClass
		//该默认设置方式缺点是：当参数值为false时，会变成true，因此需要加一个if判断
		if(setcurrent != false){
			setcurrent = setcurrent ? setcurrent : true
		}
		//设置边界值，避免标注框超出范围
		var adjust_data = adjust_boundary_bbox(imagename, startx, starty, movedWidth, movedHeight)
		startx = adjust_data.x
		starty = adjust_data.y
		movedWidth = adjust_data.width
		movedHeight = adjust_data.height
		//调整后满足最小要求才能添加保存
		if (movedWidth > minBBoxWidth / scale && movedHeight > minBBoxHeight / scale) {
			//左上，右上，右下，左下
			var point = [[startx, starty], [startx + movedWidth, starty], [startx, starty + movedHeight], [startx + movedWidth, starty + movedHeight]]
			var bbox = storeNewBbox(point, startx, starty, movedWidth, movedHeight, setcurrent, classname, imagename)
			//是否需要设置currentbbox
			if(setcurrent == "t" || setcurrent == true){
				currentBbox = {
					bbox: bbox,
					index: bboxes[imagename][classname].length - 1,
					originalX: bbox.x,
					originalY: bbox.y,
					originalWidth: bbox.width,
					originalHeight: bbox.height,
					moving: false,
					resizing: null
				}
			}
		}
    }
	
	const adjust_boundary_bbox = (imagename, x, y, width, height) => {
		var image_w = images[imagename]["width"]
		var image_h = images[imagename]["height"]
		var adjust_x = 0
		var adjust_y = 0
		//坐标x超界
		if(x < 0){
			adjust_x = 0 - x
			x = 0
		}else if(x > image_w){
			adjust_x = image_w - x
			x = image_w
		}
		//坐标y超界
		if(y < 0){
			adjust_y = 0 - y
			y = 0
		}else if(y > image_h){
			adjust_y = image_h - y
			y = image_y
		}
		//xy超界，width和height要跟着调整
		width = width - adjust_x
		height = height - adjust_y
		//width、height超界
		width = x + width > image_w ? image_w - x : width
		height = y + height > image_h ? image_h - y : height
		var adjust_data = {x: x, y: y, width: width, height: height}
		return adjust_data
	}
	
    const updateBboxAfterTransform = () => {
        if (currentBbox.resizing !== null) {
            if (currentBbox.bbox.width < 0) {
                currentBbox.bbox.width = Math.abs(currentBbox.bbox.width)
                currentBbox.bbox.x -= currentBbox.bbox.width
            }
            if (currentBbox.bbox.height < 0) {
                currentBbox.bbox.height = Math.abs(currentBbox.bbox.height)
                currentBbox.bbox.y -= currentBbox.bbox.height
            }
            currentBbox.resizing = null
        }
		currentBbox.bbox.marked = true
		currentBbox.moving = false
		//确保不超界
		var adjust_data = adjust_boundary_bbox(currentImage["name"], currentBbox.bbox.x, currentBbox.bbox.y, currentBbox.bbox.width, currentBbox.bbox.height)
		currentBbox.bbox.x = adjust_data.x
		currentBbox.bbox.y = adjust_data.y
		currentBbox.bbox.width = adjust_data.width
		currentBbox.bbox.height = adjust_data.height
		if (currentBbox.bbox.width > minBBoxWidth / scale && currentBbox.bbox.height > minBBoxHeight / scale) { // 调整完满足最小要求
			//调整完满足最小要求，更新bbox信息
			currentBbox.originalX = currentBbox.bbox.x
			currentBbox.originalY = currentBbox.bbox.y
			currentBbox.originalWidth = currentBbox.bbox.width
			currentBbox.originalHeight = currentBbox.bbox.height
		}else{
			//调整完不满足最小要求，恢复bbox信息
			currentBbox.bbox.x = currentBbox.originalX
			currentBbox.bbox.y = currentBbox.originalY
			currentBbox.bbox.width = currentBbox.originalWidth
			currentBbox.bbox.height = currentBbox.originalHeight
		}
    }
	
	//暂时无用
    const setBboxMarkedState = () => {
		if (currentBbox === null || (currentBbox.moving === false && currentBbox.resizing === null)) {
            
			const currentBboxes = bboxes[currentImage.name]
			
            let wasInside = false
            let smallestBbox = Number.MAX_SAFE_INTEGER
            for (let className in currentBboxes) {
                for (let i = 0; i < currentBboxes[className].length; i++) {
                    const bbox = currentBboxes[className][i]

                    bbox.marked = false

                    const endX = bbox.x + bbox.width
                    const endY = bbox.y + bbox.height
                    const size = bbox.width * bbox.height
                    if (mouse.startRealX >= bbox.x && mouse.startRealX <= endX
                        && mouse.startRealY >= bbox.y && mouse.startRealY <= endY) {

                        wasInside = true
						
                        if (size < smallestBbox) { // Make sure select the inner if it's inside a bigger one
                            //console.log(smallestBbox, size)
							smallestBbox = size
                            currentBbox = {
                                bbox: bbox,
                                index: i,
                                originalX: bbox.x,
                                originalY: bbox.y,
                                originalWidth: bbox.width,
                                originalHeight: bbox.height,
                                moving: false,
                                resizing: null
                            }
                        }
                    }
                }
            }
            if (wasInside === false) { // No more selected bbox
                currentBbox = null
            }
        }
    }
	
	const trackPointer = (event) => {
		//获取鼠标相对于浏览器画布的位置
		mouse.bounds = canvas.element.getBoundingClientRect()
		mouse.x = event.clientX - mouse.bounds.left
		mouse.y = event.clientY - mouse.bounds.top
		//在更新realX和realY前先保存在xx和yy中，即上一时刻的realX和realY
		var xx = mouse.realX
		var yy = mouse.realY
		//获取鼠标相对于图片的相对位置，即导出的真实位置
		mouse.realX = zoomXInv(mouse.x)
		mouse.realY = zoomYInv(mouse.y)
		//判断各种鼠标情况
		if (event.type === "mousedown") {//按下
			if(event.which === 1 && (Object.keys(classes).length == 0 || Object.keys(images).length == 0)){
				//点击了左键，但没有图片或没有类
				alert("标注失败：请先添加图片和分类！")
			}else if(event.which === 1 && currentClass == null){//点击了左键，但没有选择分类
				alert("标注失败：请先选择分类，再进行标注框描绘！")
			}else if(event.which === 1 && currentImage == null){//点击了左键，但没有选择图片
				alert("标注失败：请先选择图片，再进行标注框描绘！")
			}else{//点击了按键
				//点击右键则准备移动整张图片，点击左键则记录目前鼠标位置，准备bbox操作
				click_mousestate(event)
			}
		} else if (event.type === "mouseup" || event.type === "mouseout") {//松开或出界
			if((mouse.state == "move" || mouse.state == "resize") && currentBbox != null){updateBboxAfterTransform()}//上一时刻在移动或者调整，则需要更新currentbbox参数
			if (mouse.state === "create") {
				var movedWidth = Math.max((mouse.startRealX - mouse.realX), (mouse.realX - mouse.startRealX))
				var movedHeight = Math.max((mouse.startRealY - mouse.realY), (mouse.realY - mouse.startRealY))
				if (movedWidth > minBBoxWidth / scale && movedHeight > minBBoxHeight / scale) { // Only add if bbox is big enough
					storeNewBbox_squre(movedWidth, movedHeight)
					set_imagestate(currentImage.name)//设置图片状态，有标注框则变为蓝色，无则默认为黑色
				}
			}
			mouse.state = "default"//松开鼠标后切换鼠标为静默状态
			document.body.style.cursor = "default"
		} else if (event.type === "mousemove") {
			move_mousestate(xx, yy)
		}
		FreshCanvas()
    }
	
	const move_mousestate = (xx, yy) => {//移动的时候判断改变鼠标状态，调用的时候默认当前有选择图片和类
		const createbbox = () => {
			//FreshCanvas()里存在画新bbox代码，此处仅改变鼠标状态
			document.body.style.cursor = "crosshair"
		}
		
		const moveimage = (xx, yy) => {//移动图片
			canvasX -= mouse.realX - xx
            canvasY -= mouse.realY - yy
			//移动完，先更新realX和realY避免抖动，因为trackPointer执行会先获取xx和yy再更新realX和realY
            mouse.realX = zoomXInv(mouse.x)
            mouse.realY = zoomYInv(mouse.y)
			document.body.style.cursor = "move"
		}
		
		const movebbox = () => {//移动bbox
			currentBbox.bbox.x = currentBbox.originalX + (mouse.realX - mouse.startRealX)
			currentBbox.bbox.y = currentBbox.originalY + (mouse.realY - mouse.startRealY)
			//updatebbox_aftertransform()
		}
		
		const resizebbox = () => {
			const topLeftX = currentBbox.bbox.x
			const topLeftY = currentBbox.bbox.y
			const bottomLeftX = currentBbox.bbox.x
			const bottomLeftY = currentBbox.bbox.y + currentBbox.bbox.height
			const topRightX = currentBbox.bbox.x + currentBbox.bbox.width
			const topRightY = currentBbox.bbox.y
			const bottomRightX = currentBbox.bbox.x + currentBbox.bbox.width
			const bottomRightY = currentBbox.bbox.y + currentBbox.bbox.height
			//获取目前状态
			if (mouse.startRealX >= (topLeftX - edgeSize / scale) && mouse.startRealX <= (topLeftX + edgeSize / scale)
				&& mouse.startRealY >= (topLeftY - edgeSize / scale) && mouse.startRealY <= (topLeftY + edgeSize / scale)) {
				currentBbox.resizing = "topLeft"//左上
			} else if (mouse.startRealX >= (bottomLeftX - edgeSize / scale) && mouse.startRealX <= (bottomLeftX + edgeSize / scale)
				&& mouse.startRealY >= (bottomLeftY - edgeSize / scale) && mouse.startRealY <= (bottomLeftY + edgeSize / scale)) {
				currentBbox.resizing = "bottomLeft"//左下
			} else if (mouse.startRealX >= (topRightX - edgeSize / scale) && mouse.startRealX <= (topRightX + edgeSize / scale)
				&& mouse.startRealY >= (topRightY - edgeSize / scale) && mouse.startRealY <= (topRightY + edgeSize / scale)) {
				currentBbox.resizing = "topRight"//右上
			} else if (mouse.startRealX >= (bottomRightX - edgeSize / scale) && mouse.startRealX <= (bottomRightX + edgeSize / scale)
				&& mouse.startRealY >= (bottomRightY - edgeSize / scale) && mouse.startRealY <= (bottomRightY + edgeSize / scale)) {
				currentBbox.resizing = "bottomRight"//右下
			}
			//进行调整
			if (currentBbox.resizing === "topLeft") {//左上，bbox的xy都要变
				currentBbox.bbox.x = mouse.realX
				currentBbox.bbox.y = mouse.realY
				currentBbox.bbox.width = currentBbox.originalX + currentBbox.originalWidth - mouse.realX
				currentBbox.bbox.height = currentBbox.originalY + currentBbox.originalHeight - mouse.realY
			} else if (currentBbox.resizing === "bottomLeft") {//左下，bbox.y不需要变
				currentBbox.bbox.x = mouse.realX
				currentBbox.bbox.width = currentBbox.originalX + currentBbox.originalWidth - mouse.realX
				currentBbox.bbox.height = mouse.realY - currentBbox.originalY
			} else if (currentBbox.resizing === "topRight") {//右上，bbox.x不需要变
				currentBbox.bbox.y = mouse.realY
				currentBbox.bbox.width = mouse.realX - currentBbox.originalX
				currentBbox.bbox.height = currentBbox.originalY + currentBbox.originalHeight - mouse.realY
			} else if (currentBbox.resizing === "bottomRight") {//右下，bbox的xy都不需要变
				currentBbox.bbox.width = mouse.realX - currentBbox.originalX
				currentBbox.bbox.height = mouse.realY - currentBbox.originalY
			}
		}
		
		const find_pointer_bbox = () => {//寻找目前鼠标在哪个bbox里面
			canclick_bboxinfo = {}
			var distance = Infinity
			mouse.state = "default"
			document.body.style.cursor = "default"
			if(Object.keys(bboxes).length > 0){
				var currentBboxes = bboxes[currentImage.name]
				//在当前图片的bboxes里面逐个搜索，看鼠标在哪个bbox范围内
				//bug（已修复）：当上一时刻删除了标注框，鼠标状态为click，且恰好当前没有任何一个标注框了，鼠标就无法进入default状态
				//只需要在此前判断是否有标注框，没有就直接设置为default即可
				for (var className in currentBboxes) {
					for (var i = 0; i < currentBboxes[className].length; i++) {
						var bbox = currentBboxes[className][i]//获取该bbox
						var endX = bbox.x + bbox.width
						var endY = bbox.y + bbox.height
						//在允许范围内，则鼠标变为手指，指示用户可以选择
						if (mouse.realX >= (bbox.x + edgeSize / scale) && mouse.realX <= (endX - edgeSize / scale)
							&& mouse.realY >= (bbox.y + edgeSize / scale) && mouse.realY <= (endY - edgeSize / scale)) {
							document.body.style.cursor = "pointer"//手指
							var d = (mouse.realX - bbox.x) * (mouse.realX - bbox.x) + (mouse.realY - bbox.y) * (mouse.realY - bbox.y)
							if (d < distance){
								distance = d
								canclick_bboxinfo = {"imagename": currentImage.name, "classname": className, "index": i}
								mouse.state = "canclick"
							}
							//break//一个break只能退出内层循环
						}
					}
					//由于一个break只能退出内层循环，因此需要加第二个break退出外层循环
					//bug（已修复）：当之前变成了canclick状态，且删掉标注框，刚好className排名第一，且className的标注框只有一个
					//就会导致currentBboxes[className]的标注框数目为0，每次鼠标移动会直接触发该break。只需要删除标注框后重新整理bboxes就能解决
					//if(mouse.state == "canclick"){break}
				}
			}
			return canclick_bboxinfo//canclick_bboxinfo为全局变量，储存目标所指bbox的索引数据
		}
		
		//为避免未载入图片就鼠标乱动报错，当选了图片，才有可能移动bbox
		if(currentImage != null && (mouse.state == "default" || mouse.state == "canclick" || mouse.state == "canmove" || mouse.state == "canresize" || mouse.state == "click")){
			if (currentBbox == null){//当前没有选择bbox
				find_pointer_bbox()
			}else{//当前有选择bbox，准备移动或者调整大小
				var topLeftX = currentBbox.bbox.x
				var topLeftY = currentBbox.bbox.y
				var bottomLeftX = currentBbox.bbox.x
				var bottomLeftY = currentBbox.bbox.y + currentBbox.bbox.height
				var topRightX = currentBbox.bbox.x + currentBbox.bbox.width
				var topRightY = currentBbox.bbox.y
				var bottomRightX = currentBbox.bbox.x + currentBbox.bbox.width
				var bottomRightY = currentBbox.bbox.y + currentBbox.bbox.height
				
				if (mouse.realX >= (topLeftX + edgeSize / scale) && mouse.realX <= (bottomRightX - edgeSize / scale)
					&& mouse.realY >= (topLeftY + edgeSize / scale) && mouse.realY <= (bottomRightY - edgeSize / scale)) {
					document.body.style.cursor = "move"//移动
					mouse.state = "canmove"
				} else if (mouse.realX >= (topLeftX - edgeSize / scale) && mouse.realX <= (topLeftX + edgeSize / scale)
					&& mouse.realY >= (topLeftY - edgeSize / scale) && mouse.realY <= (topLeftY + edgeSize / scale)) {
					document.body.style.cursor = "nwse-resize"//左上角变形
					mouse.state = "canresize"
				} else if (mouse.realX >= (bottomLeftX - edgeSize / scale) && mouse.realX <= (bottomLeftX + edgeSize / scale)
					&& mouse.realY >= (bottomLeftY - edgeSize / scale) && mouse.realY <= (bottomLeftY + edgeSize / scale)) {
					document.body.style.cursor = "nesw-resize"//左下角变形
					mouse.state = "canresize"
				} else if (mouse.realX >= (topRightX - edgeSize / scale) && mouse.realX <= (topRightX + edgeSize / scale)
					&& mouse.realY >= (topRightY - edgeSize / scale) && mouse.realY <= (topRightY + edgeSize / scale)) {
					document.body.style.cursor = "nesw-resize"//右上角变形
					mouse.state = "canresize"
				} else if (mouse.realX >= (bottomRightX - edgeSize / scale) && mouse.realX <= (bottomRightX + edgeSize / scale)
					&& mouse.realY >= (bottomRightY - edgeSize / scale) && mouse.realY <= (bottomRightY + edgeSize / scale)) {
					document.body.style.cursor = "nwse-resize"//右下角变形
					mouse.state = "canresize"
				} else {//鼠标移出bbox范围外
					//document.body.style.cursor = "default"
					//mouse.state = "default"
					find_pointer_bbox()
				}
			}
		}else if(mouse.state == "move" || mouse.state == "resize"){
			if (currentBbox != null){//当currentBbox还在的时候，才允许移动或者变形，否则变为default
				if(mouse.state == "move"){movebbox()}//正在移动
				else if(mouse.state == "resize"){resizebbox()}//正在变形
			}else{
				mouse.state = "default"
				document.body.style.cursor = "default"
			}
		}else if(mouse.state == "moveimage"){//正在移动画布
			moveimage(xx, yy)
		}else if(mouse.state == "create"){//正在创建标注框
			createbbox()
		}
	}
	
	const click_mousestate = (event) => {//点击的时候判断改变鼠标状态，调用的时候默认当前有选择图片和类		
		if (event.which === 3) {//点击了右键
			mouse.state = "moveimage"
		}else if (event.which === 1) {//点击了左键
			mouse.startRealX = mouse.realX
			mouse.startRealY = mouse.realY
			if(mouse.state == "canclick"){//可以点击选择bbox状态
				var bbox = bboxes[canclick_bboxinfo["imagename"]][canclick_bboxinfo["classname"]][canclick_bboxinfo["index"]]
				bbox.marked = true
				if(currentBbox != null){currentBbox.bbox.marked = false}//避免之前就有currentBbox，要把之前的marked取消掉
				currentBbox = {
					bbox: bbox, index: canclick_bboxinfo["index"],
					originalX: bbox.x, originalY: bbox.y,
					originalWidth: bbox.width, originalHeight: bbox.height,
					moving: false, resizing: null
				}
				mouse.state = "click"//点击完，将鼠标状态改成点击
			}else if(mouse.state == "canmove"){//准备可以移动动态
				mouse.state = "move"
			}else if(mouse.state == "canresize"){//准备可以调整大小状态
				mouse.state = "resize"
			}else if(mouse.state == "default"){//静默状态，点击了currentBbox外面，接下来可能会创建bbox
				if(currentBbox != null){
					currentBbox.bbox.marked = false
					currentBbox = null
				}
				mouse.state = "create"
			}else if(mouse.state == "move" || mouse.state == "resize"){
				//正常来说，仅当鼠标按住的时候才会存在move和resize状态，松开就会在trackPointer()恢复为dafault，因此不需要处理
			}
		}
		
	}

    const zoom = (number) => {
        return Math.floor(number * scale)
    }

    const zoomX = (number) => {
        return Math.floor((number - canvasX) * scale + screenX)
    }

    const zoomY = (number) => {
        return Math.floor((number - canvasY) * scale + screenY)
    }

    const zoomXInv = (number) => {
        return Math.floor((number - screenX) * (1 / scale) + canvasX)
    }

    const zoomYInv = (number) => {
        return Math.floor((number - screenY) * (1 / scale) + canvasY)
    }

    const listenImageLoad = () => {
        document.getElementById("images").addEventListener("change", (event) => {
            const imageList = document.getElementById("imageList")
            const files = event.target.files
            if (files.length > 0) {
                resetImageList()
                document.body.style.cursor = "wait"
				//读入名字，添加选项
                for (let i = 0; i < files.length; i++) {
                    const nameParts = files[i].name.split(".")
                    if (extensions.indexOf(nameParts[nameParts.length - 1]) !== -1) {
                        images[files[i].name] = {
                            meta: files[i],
                            index: i
                        }
                        const option = document.createElement("option")
                        option.value = files[i].name
                        option.innerHTML = files[i].name
                        if (i === 0) {
                            option.selected = true
                        }
                        imageList.appendChild(option)
                    }
                }
				//读取文件内容，添加进画布
                const imageArray = Object.keys(images)
                let l = imageArray.length
                for (let image in images) {
                    const reader = new FileReader()
                    reader.addEventListener("load", () => {
                        const imageObject = new Image()
                        imageObject.addEventListener("load", (event) => {
                            images[image].width = event.target.width
                            images[image].height = event.target.height
                            if (--l === 0) {//最后一个读完了
                                setCurrentImage(images[imageArray[0]])//设置currentimage的时候会自动刷新屏幕
                                document.getElementById("restoreBboxes_file").disabled = false
								Restore_browser()//检测导入浏览器本地缓存数据，防止上一次意外中断
								document.body.style.cursor = "default"
                            }
                        })
                        imageObject.src = reader.result
                    })
                    reader.readAsDataURL(images[image].meta)
                }
				imageListIndex = imageList.selectedIndex
				document.getElementById("restoreBboxes_label").removeAttribute("hidden")
				document.getElementById("restoreBboxes_file").removeAttribute("hidden")
				document.getElementById("restoreBboxes_hr").removeAttribute("hidden")
			}
		})
    }

    const resetImageList = () => {
        const imageList = document.getElementById("imageList")
        imageList.innerHTML = ""
        images = {}
        bboxes = {}
        currentImage = null
    }

    const setCurrentImage = (image) => {
        if (resetCanvasOnChange === true) {
            resetCanvasPlacement()
        }

        if (fittedZoom === true) {
            fitZoom(image)
        }

        const reader = new FileReader()

        reader.addEventListener("load", () => {
            const dataUrl = reader.result
            const imageObject = new Image()

            imageObject.addEventListener("load", () => {
                currentImage = {
                    name: image.meta.name,
                    object: imageObject,
                    width: image.width,
                    height: image.height
                }
				FreshCanvas()//凡是要设置currentimage的都要刷新屏幕
            })
            imageObject.src = dataUrl
            document.getElementById("imageInformation")
                .innerHTML = `${image.width}x${image.height}, ${formatBytes(image.meta.size)}`
        })

        reader.readAsDataURL(image.meta)

        if (currentBbox !== null) {
            currentBbox.bbox.marked = false // We unmark via reference
            currentBbox = null // and the we delete
        }
		if(task == "classification"){unselectclass()}
    }
	
	const set_imagestate = (image) => {//设置图片文字状态，有bbox则为蓝色，否则为黑色
		var image = image ? image : false
		var options = document.getElementById("imageList").children
		if(image != false){//有传参数进来
			var image_index = null
			if(typeof(image) == "object"){image_index = image["index"]}//传进来了一整个image类，要找到其index
			else if(typeof(image) == "string"){image_index = images[image]["index"]}//传进来了一个字符串，是图片的名字
			else if(typeof(image) == "number"){image_index = image}//传进来的是index，或者通过上一行改成了index
			if(bboxes.hasOwnProperty(options[image_index].value)){options[image_index].style.color = "blue"}//如果该图片已经有标注框，则变成蓝色
			else{options[image_index].style.color = "black"}//否则变回默认黑色
		}else{//没有传参数进来，只能一个一个核对
			for(var i = 0; i < options.length; i++){
				if(bboxes.hasOwnProperty(options[i].value)){options[i].style.color = "blue"}//如果该图片已经有标注框，则变成蓝色
				else{options[i].style.color = "black"}//否则变回默认黑色
			}
		}	
	}
	
    const fitZoom = (image) => {
		scale = canvas.width / image.width
		var scale1 = canvas.height / image.height
		if(scale1 < scale){scale = scale1}
        //if (image.width > image.height) {
        //    scale = canvas.width / image.width
        //} else {
        //    scale = canvas.height / image.height
        //}
    }

    const formatBytes = (bytes, decimals) => {
        if (bytes === 0) {
            return "0 Bytes"
        }

        const k = 1024
        const dm = decimals || 2
        const sizes = ["Bytes", "KB", "MB"]
        const i = Math.floor(Math.log(bytes) / Math.log(k))

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
    }

    const listenImageSelect = () => {
        const imageList = document.getElementById("imageList")
        imageList.addEventListener("change", () => {
            imageListIndex = imageList.selectedIndex
			ImageSelect()
        })
    }
	
	const ImageSelect = (imageName) => {
		var imageName = imageName ? imageName : imageList.options[imageListIndex].innerHTML
        setCurrentImage(images[imageName])
		if(task == "classification" && bboxes[imageName] != null && Object.keys(bboxes[imageName]).length > 0){
			var c = Object.keys(bboxes[imageName])[0]
			var bbox = bboxes[imageName][c][0]
			document.getElementById("classList").children[classes[c]].selected = true
			setCurrentClass()
			//设置currentbbox是为了提供删除bbox的可能
			currentBbox = {
				bbox: bbox,//标记
				index: 0,
				originalX: bbox.x,
				originalY: bbox.y,
				originalWidth: bbox.width,
				originalHeight: bbox.height,
				moving: false,
				resizing: null
			}
		}
	}
	
    const resetClassList = () => {
        document.getElementById("classList").innerHTML = ""
        classes = {}
		colors = {}
        currentClass = null
    }

    const setCurrentClass = () => {
        const classList = document.getElementById("classList")
		if (classList.selectedIndex != -1){
			currentClass = classList.options[classList.selectedIndex].text
			classListIndex = classList.selectedIndex
			if (currentBbox !== null) {
				currentBbox.bbox.marked = false // We unmark via reference
				currentBbox = null // and the we delete
			}
		}else{
			currentClass = null
			classListIndex = -1
		}
    }

    const listenClassSelect = () => {
        const classList = document.getElementById("classList")
        classList.addEventListener("change", () => {
            ClassSelect()
			FreshCanvas()
        })
    }
	
	const ClassSelect = () => {
		classListIndex = classList.selectedIndex
		setCurrentClass()
		setCurrentColor()
		if(task == "classification" && currentImage != null && currentClass != null){
			bboxes[currentImage.name] = {}
			storeNewBbox_squre(currentImage.width, currentImage.height, 0, 0)
			set_imagestate(currentImage.name)//设置图片状态，有标注框则变为蓝色，无则默认为黑色
		}
	}
	
    const listenBboxLoad = () => {//恢复本地标注框
		var bboxesElement = document.getElementById("restoreBboxes_file")
		var readers = []
		var files = []
		var files_num = 0 //需要完成导入的文件个数
		
        const restore = async(extension, i) => {
			var reader = readers[i]
			var file = files[i]
			if (extension === "txt" || extension === "xml" || extension === "json") {
				if(task == "detection"){restoreBbox_detection(file.name, reader.result)}
				else if(task == "classification"){restoreBbox_classification(file.name, reader.result)}
				files_num = files_num - 1//完成了一个
            } else{
                var zip = new JSZip()
                var result = await zip.loadAsync(reader.result)//等待zip读取，再获取结果
				for (var filename in result.files) {
					var extension = filename.split(".").pop()
					if(extension == "xml" || extension == "txt" || extension == "json"){
						var text = await result.file(filename).async("string")//等待获取压缩文件数据
						filename = filename.split("/").pop()
						filename = filename.split("\\").pop()
						if(task == "detection"){restoreBbox_detection(filename, text)}
						else if(task == "classification"){restoreBbox_classification(filename, text)}
					}else if(extension == "zip"){
						alert("检测到存在文件 " + filename + " ，不支持嵌套压缩！")
					}
				}
				files_num = files_num - 1//完成了一个
            }
			if(files_num == 0){FreshCanvas()}//全部导入完成，刷新画布
		}

        bboxesElement.addEventListener("click", () => {
            bboxesElement.value = null
        })

        bboxesElement.addEventListener("change", (event) => {
			//导入标签提示信息
			var str = ["注意：\n",
						"1.请确定目前的任务是否所要导入标签对应的任务。",
						"2.导入本地标签文件后，无法再更改数据任务，且清空所有现有标注框\n",
						"3.VOC标签格式默认的是.xml文件，COCO标签格式默认的是.json文件，YOLO标签格式默认的是.txt文件，请核对清楚，否则会导入失败。\n",
						"4.由于yolo格式的特性，yolo标签文件仅有分类序号而没有具体的分类名称。因此，如导入yolo标签文件，请核对目前的分类序号与标签文件分类序号是否一致。"
					]
			//不从classes而从classList获取各个类的原因：从classes直接从键获取，序号顺序会乱
			var options = document.getElementById("classList")
			if(options.length > 0){
				str.push("\n")
				str.push("————以下是目前的分类信息：\n")
				for(var i = 0; i < options.length; i++){
					var option = options[i]
					var classname = option.innerHTML.trim()
					str.push("——————序号" +classes[classname] + "对应的类名:" + classname + "\n")
				}
			}
			//确认导入
			var r=confirm(str.join(""));
			if (r==true){
				removelistenTask()
				files = event.target.files
				if (files.length > 0) {
					bboxes = {}//先清空所有的bboxes，后期完善好功能就可以不需要
					for (var i = 0; i < files.length; i++) {
						var reader = new FileReader()
						readers[i] = reader
						var extension = files[i].name.split(".").pop()
						readers[i].addEventListener("load", restore.bind(this, extension, i))
						//仅支持txt、xml、json或者其zip压缩格式
						if (extension === "txt" || extension === "xml"  || extension === "json") {
							readers[i].readAsText(files[i])
							files_num = files_num + 1
						} else if(extension === "zip"){
							readers[i].readAsArrayBuffer(event.target.files[i])
							files_num = files_num + 1
						}else{
							alert("仅支持导入txt、xml、json或者其zip压缩格式标签数据")
						}
					}
				}
			}
			
        })
    }
	
	const restoreBbox_classification = (filename, text) => {//从本地标注框恢复，分类任务
		const storebbox_voc = (imagename, classname) => {
			//根据分类标注框规则设置标注框数据
			var w = images[imagename].width
			var h = images[imagename].height
			storeNewBbox_squre(w, h, 0, 0, imagename, classname, false)
			set_imagestate(imagename)
		}
		
		var xmlDoc = new DOMParser().parseFromString(text, "text/xml")//转换为xml识别格式
		var objects = xmlDoc.getElementsByTagName("annotation")[0].getElementsByTagName("object")
		var images_name = Object.keys(images)
		var bbox = null
		for(var i = 0; i < objects.length; i++){
			var imagename_xml = objects[i].getElementsByTagName("filename")[0].childNodes[0].nodeValue
			var c = objects[i].getElementsByTagName("classification")[0].childNodes[0].nodeValue//获取xml文件的类名
			var find = false
			for (let i = 0; i < extensions.length; i++) {//在所允许的拓展名里面一个一个试
                var imageName = imagename_xml.replace(`.xml`, `.${extensions[i]}`)
				if(images_name.indexOf(imageName) !== -1){//该图片已经导入
					find = true
					bbox = bboxes[imageName]//在目前的标注框情况下进行本地标注恢复
					var index = Object.keys(classes).indexOf(c)
					if(index !== -1){//在现有的类里面找到了
						if (typeof(bbox) === "undefined" || typeof(bbox[c]) === "undefined") {//此类目前没有标注框
							bboxes[imageName] = {}//先初始化，将原本的清空，因为分类只会在一个类中
							storebbox_voc(imageName, c)
                        }
						//否则，已经有了分类标注框，同一个类，不需要操作
						//else{
						//	var r=confirm("图片 “" + imageName + "” 的本地分类信息与当前分类信息冲突，点击确认则将本地分类覆盖到当前");
						//	if (r==true){
						//		//bboxes[imageName] = {}//先初始化，将原本的清空
						//		storebbox_voc(imageName, c)
						//	}
						//}
					}else if(ignore_class.indexOf(c) == -1){//在现有的类里面找不到，且不在忽略类列表中
						var r=confirm("在已添加的类中没有 “" + c + "” ，但所导入的标签文件 “" + filename + "” 中存在，是否需要添加此类和标注？（如点击取消则忽略此类不再提示添加）");
						if (r==true){
							addclass(c)//增加这个类
							bboxes[imageName] = {}//先初始化，将原本的清空，因为分类只会在一个类中
							storebbox_voc(imageName, c)
						}else{
							ignore_class.push(c)//在忽略列表中增加这个类
						}
					}
					break
				}
			}
			if(find == false && ignore_image.indexOf(imageName.split(".")[0]) == -1){//该图片未导入且不在忽略名单内
				ignore_image.push(imageName.split(".")[0])
				alert("导入本地标签文件过程中发现未添加图片：" + imageName)
			}
		}
		bboxes_sort()//整理去重bboxes
	}
	
	
    const restoreBbox_detection = (filename, text) => {//从本地标注框恢复，目标检测任务
		const storebbox_voc = (object, imagename, classname) => {
			//读取本地标注框数据
			var bndBox = object.getElementsByTagName("bndbox")[0]
			var bndBoxX = bndBox.getElementsByTagName("xmin")[0].childNodes[0].nodeValue
			var bndBoxY = bndBox.getElementsByTagName("ymin")[0].childNodes[0].nodeValue
 			var bndBoxMaxX = bndBox.getElementsByTagName("xmax")[0].childNodes[0].nodeValue
			var bndBoxMaxY = bndBox.getElementsByTagName("ymax")[0].childNodes[0].nodeValue
			//存到现在的bboxes里
			var w = parseInt(bndBoxMaxX) - parseInt(bndBoxX)
			var h = parseInt(bndBoxMaxY) - parseInt(bndBoxY)
			storeNewBbox_squre(w, h, parseInt(bndBoxX), parseInt(bndBoxY), imagename, classname, false)
			set_imagestate(imagename)
		}
		
		const storebbox_coco = (annotation, imagename, classname) => {
			//读取本地标注框数据
			var bboxX = annotation.bbox[0]
			var bboxY = annotation.bbox[1]
			var bboxWidth = annotation.bbox[2]
			var bboxHeight = annotation.bbox[3]				
			//储存bbox
			storeNewBbox_squre(parseInt(bboxWidth), parseInt(bboxHeight), parseInt(bboxX), parseInt(bboxY), imagename, classname, false)
			set_imagestate(imagename)
		}
		
		const storebbox_yolo = (cols, imagename, classname) => {
			//读取本地标注框数据
			var width = cols[3] * image.width
            var x = cols[1] * image.width - width * 0.5
            var height = cols[4] * image.height
            var y = cols[2] * image.height - height * 0.5			
			//储存bbox
			storeNewBbox_squre(parseInt(width), parseInt(height), parseInt(x), parseInt(y), imagename, classname, false)
			set_imagestate(imagename)
		}
		
        var image = null
        var bbox = null
        var extension = filename.split(".").pop()
        if (extension === "txt" || extension === "xml") {
			var find = false
            for (var i = 0; i < extensions.length; i++) {//在所允许的拓展名里面一个一个试
                var imageName = filename.replace(`.${extension}`, `.${extensions[i]}`)
                if (typeof(images[imageName]) !== "undefined") {//已经导入了该图片
                    image = images[imageName]
					find = true
                    if (typeof(bboxes[imageName]) === "undefined") {//该图片目前没有标注框
                        bboxes[imageName] = {}//先初始化
                    }
                    bbox = bboxes[imageName]//在目前的标注框情况下进行本地标注恢复
                    if (extension === "txt") {//yolo格式
                        var rows = text.split(/[\r\n]+/)//分割每一行
						//找到标签文件中最大的类序数，缺少的类进行添加
						var class_index_max = -1//txt标签文件中最大的序数
						for (var j = 0; j < rows.length; j++) {
							var class_index_this = parseInt(rows[j].split(" ")[0])
							if(class_index_this > class_index_max){class_index_max = class_index_this}
						}
						var classes_keys = Object.keys(classes)
						if(class_index_max > classes_keys.length - 1){//标签文件最大序号比目前的类最大序号要大
							var class_index_add = []//需要添加的类序号
							for(var j = classes_keys.length; j <= class_index_max; j++){class_index_add.push(j.toString())}//获取需要添加的类序号
							if(class_index_add.length > 0){
								var r=confirm("在已添加的类中没有序号为" + class_index_add.join("、") + "对应的类 ，但所导入的标签文件 “" + filename + "” 中存在，是否以序号为名称需要添加类？（如点击取消则不再提示添加）");
								if (r==true){
									//以序号为名称添加类
									for(var j = 0; j < class_index_add.length; j++){
										addclass(class_index_add[j])
									}
								}
							}
						}
						//添加标注框
                        for (var i = 0; i < rows.length; i++) {
                            var cols = rows[i].split(" ")
                            cols[0] = parseInt(cols[0])
							var classes_keys = Object.keys(classes)
							if(cols[0] < classes_keys.length){//有相应序号的类
								var className = classes_keys[cols[0]]//获取类名
								storebbox_yolo(cols, imageName, className)
							}
                        }
                    } else if (extension === "xml") {//voc格式
                        var xmlDoc = new DOMParser().parseFromString(text, "text/xml")//转换为xml识别格式
                        var objects = xmlDoc.getElementsByTagName("object")
                        for (var j = 0; j < objects.length; j++) {
                            var className = objects[j].getElementsByTagName("name")[0].childNodes[0].nodeValue//获取xml结点值
                            var index = Object.keys(classes).indexOf(className)
							if(index !== -1){//在现有的类里面找到了
								//if (typeof(bbox[className]) === "undefined") {//此类目前没有标注框
                                //    bbox[className] = []//先初始化
                                //}
								storebbox_voc(objects[j], imageName, className)
							}else if(ignore_class.indexOf(className) == -1){//在现有的类里面找不到，且不在忽略类列表中
								var r=confirm("在已添加的类中没有 “" + className + "” ，但所导入的标签文件 “" + filename + "” 中存在，是否需要添加此类？（如点击取消则忽略此类不再提示添加）");
								if (r==true){
									addclass(className)
									//bbox[className] = []//先初始化
									storebbox_voc(objects[j], imageName, className)
								}else{
									ignore_class.push(className)
								}
							}
                        }
                    }
					break
                }
            }
			if(find == false && ignore_image.indexOf(filename.split(".")[0]) == -1){
				ignore_image.push(filename.split(".")[0])
				alert("导入本地标签文件过程中发现未添加图片：" + filename.split(".")[0])
			}
        } else {//coco格式，json
            var json = JSON.parse(text)//转换为json
            for (var i = 0; i < json.annotations.length; i++) {//一个一个annotation查询
                var annotation = json.annotations[i]
				var imagename_object = null
                var className = null
				//标签文件中一个一个image去找，找到annotation的imageid对应的inamgename
                for (var j = 0; j < json.images.length; j++) {
                    if (annotation.image_id === json.images[j].id) {
                        imagename_object = json.images[j].file_name//找到了相应的imagename
						break//找到了就不需要继续循环了
                    }
                }
				//标签文件中一个一个categories去找，找到annotation的category_id对应的category
				for (var j = 0; j < json.categories.length; j++) {
					if (annotation.category_id === json.categories[j].id) {
						className = json.categories[j].name//提取相应的分类名
						break
					}
				}
				//开始处理该个annotation
				var find = false
				for (let i = 0; i < extensions.length; i++) {//在所允许的拓展名里面一个一个试
					var imageName = imagename_object.replace(`.${extension}`, `.${extensions[i]}`)
					if (typeof(images[imageName]) !== "undefined") {//找到了相应的图片
						find = true
						image = images[imageName]
						var index = Object.keys(classes).indexOf(className)
						if(index !== -1){//在现有的类里面找到了
							storebbox_coco(annotation, imageName, className)
						}else if(ignore_class.indexOf(className) == -1){//在现有的类里面找不到，且不在忽略类列表中
							var r=confirm("在已添加的类中没有 “" + className + "” ，但所导入的标签文件 “" + filename + "” 中存在，是否需要添加此类？（如点击取消则忽略此类不再提示添加）");
							if (r==true){
								addclass(className)
								storebbox_coco(annotation, imageName, className)
							}else{
								ignore_class.push(className)
							}
						}
						break//在某个拓展名里面找到了这个图象，不再需要循环
					}
				}
            }
        }
		bboxes_sort()//整理去重bboxes
    }
	
	const listenLabelsSave = () => {
		document.getElementById("save").addEventListener("click", LabelsSave)
	}
	
	const LabelsSave = () => {
		const classificationsave = (zip) => {
			var result = ["<annotation>"]
			for (let imageName in bboxes) {
				var path = images_foldername + "\\" + imageName
				var c = Object.keys(bboxes[imageName])[0]
				result.push("	<object>")
				result.push(`		<folder>${images_foldername}</folder>`)
				result.push(`		<filename>${imageName}</filename>`)
				result.push(`		<path>${path}</path>`)
				result.push(`		<classification>${c}</classification>`)
				result.push("	</object>")
			}
			result.push("</annotation>")
			zip.file(label_foldername + "_classification\\" + "label.xml", result.join("\n"))
			return zip
		}
		const yolosave = (zip) => {
			for (let imageName in bboxes) {
				var image = images[imageName]
				var name = imageName.split(".")
				name[0] = label_foldername + "_yolo\\" + name[0]
				name[name.length - 1] = "txt"
				var result = []
				for (let className in bboxes[imageName]) {
					for (let i = 0; i < bboxes[imageName][className].length; i++) {
						var bbox = bboxes[imageName][className][i]
						// Prepare data for yolo format
						var x = (bbox.x + bbox.width / 2) / image.width
						var y = (bbox.y + bbox.height / 2) / image.height
						var width = bbox.width / image.width
						var height = bbox.height / image.height
						result.push(`${classes[className]} ${x} ${y} ${width} ${height}`)
					}
				}
				zip.file(name.join("."), result.join("\n"))
			}
			return zip
		}
		const vocsave = (zip) => {
			for (let imageName in bboxes) {
				var image = images[imageName]
				var name = imageName.split(".")
				name[0] = label_foldername + "_voc\\" + name[0]
				name[name.length - 1] = "xml"
				var path = images_foldername + "\\" + imageName
				var result = [
					"<annotation>",
					`	<folder>${images_foldername}</folder>`,
					`	<filename>${imageName}</filename>`,
					`	<path>${path}</path>`,
					"	<source>",
					"		<database>Unknown</database>",
					"	</source>",
					"	<size>",
					`		<width>${image.width}</width>`,
					`		<height>${image.height}</height>`,
					"		<depth>3</depth>",
					"	</size>",
					"	<segmented>0</segmented>"
				]
				for (var className in bboxes[imageName]) {
					for (var i = 0; i < bboxes[imageName][className].length; i++) {
						const bbox = bboxes[imageName][className][i]
						result.push("	<object>")
						result.push(`		<name>${className}</name>`)
						result.push("		<pose>Unspecified</pose>")
						result.push("		<truncated>0</truncated>")
						result.push("		<occluded>0</occluded>")
						result.push("		<difficult>0</difficult>")
						result.push("		<bndbox>")
						result.push(`			<xmin>${bbox.x}</xmin>`)
						result.push(`			<ymin>${bbox.y}</ymin>`)
						result.push(`			<xmax>${bbox.x + bbox.width}</xmax>`)
						result.push(`			<ymax>${bbox.y + bbox.height}</ymax>`)
						result.push("		</bndbox>")
						result.push("	</object>")
					}
				}
				result.push("</annotation>")
				if (result.length > 15) {
					zip.file(name.join("."), result.join("\n"))
				}
			}
			return zip
		}
		const cocosave = (zip) => {
			var result = {
				images: [],
				type: "instances",
				annotations: [],
				categories: []
			}
			for (var className in classes) {
				result.categories.push({
					supercategory: "none",
					id: classes[className] + 1,
					name: className
				})
			}
			for (var imageName in images) {
				result.images.push({
					id: images[imageName].index + 1,
					file_name: imageName, //eslint-disable-line camelcase
					width: images[imageName].width,
					height: images[imageName].height
				})
			}
			var id = 0
			for (var imageName in bboxes) {
				var image = images[imageName]
				for (var className in bboxes[imageName]) {
					for (var i = 0; i < bboxes[imageName][className].length; i++) {
						var bbox = bboxes[imageName][className][i]
						var segmentation = [
							bbox.x, bbox.y,
							bbox.x, bbox.y + bbox.height,
							bbox.x + bbox.width, bbox.y + bbox.height,
							bbox.x + bbox.width, bbox.y
						]
						result.annotations.push({
							segmentation: segmentation,
							area: bbox.width * bbox.height,
							iscrowd: 0,
							ignore: 0,
							image_id: image.index + 1, //eslint-disable-line camelcase
							bbox: [bbox.x, bbox.y, bbox.width, bbox.height],
							category_id: classes[className] + 1, //eslint-disable-line camelcase
							id: ++id
						})
					}
				}
				zip.file(label_foldername + "_coco\\" + "coco.json", JSON.stringify(result))
			}
			return zip
		}
		
		document.body.style.cursor = "wait" // Mark as busy
        var zip = new JSZip()
		var flag = {}
		//设置三个flag
		flag["flag_imagebboxes"] = false
		flag["flag_images"] = false
		flag["flag_imagecrop"] = false
		flag["flag_labels"] = false
		//判断输出原始图象、带标注框图象及标注分块图象
		image_bboxes_zip(zip, flag)
		if(document.getElementById("saveVocBboxes").checked == true){zip = vocsave(zip)}
        if(document.getElementById("saveCocoBboxes").checked == true){zip = cocosave(zip)}
		if(document.getElementById("saveYoloBboxes").checked == true){zip = yolosave(zip)}
		if(document.getElementById("saveClassification").checked == true){zip = classificationsave(zip)}
		flag["flag_labels"] = true
		zip_out(zip, flag, "images_labels.zip")
	}
	
    const Restore_browser = () => {
        var item = localStorage.getItem("savebboxes_browser")
		if (item) {
			var savebboxes_browser = JSON.parse(item)
			var imagenames_save = savebboxes_browser.imagenames.sort()
			var imagenames = Object.keys(images).sort()
			var task_save = savebboxes_browser.task
			if(imagenames_save.toString() == imagenames.toString() && task == task_save){
				var r=confirm("检测到图片有缓存工作数据，是否自动导入？");
				if (r==true){
					bboxes = savebboxes_browser.bboxes
					//先导入colors，因为导入classes之后，option的颜色要看colors
					colors = savebboxes_browser.colors
					classes = savebboxes_browser.classes
					addclassoptions_fromclasses()//恢复class的option
				}
			}

		}
		FreshCanvas()
    }

    const listenKeyboard = () => {
        const imageList = document.getElementById("imageList")
        const classList = document.getElementById("classList")
		
		//document.addEventListener("keyup", (event) => {
		//	const key = event.keyCode || event.charCode
		//	console.log(key)
		//})
		
        document.addEventListener("keydown", (event) => {
            const key = event.keyCode || event.charCode
            if (key === 46 || (key === 8 && event.metaKey === true)) {
                if (currentBbox !== null) {//删除bbox
                    bboxes[currentImage.name][currentBbox.bbox.class].splice(currentBbox.index, 1)
					//删掉bbox之后，若该图片的类的bbox剩余0个，就要重新整理bboxes且更改图片状态
					if(bboxes[currentImage.name][currentBbox.bbox.class].length == 0){
						bboxes_sort()
						set_imagestate(currentImage.name)
					}
					currentBbox = null
                }

                event.preventDefault()
            }else if (key === 37) {//按左键←
                if (imageList.length > 1) {
					if(task == "classification" && classListIndex != -1){
						classList.options[classListIndex].selected = false
						setCurrentClass()
					}
                    imageList.options[imageListIndex].selected = false
                    if (imageListIndex === 0) {
                        imageListIndex = imageList.length - 1
                    } else {
                        imageListIndex--
                    }
                    imageList.options[imageListIndex].selected = true
                    imageList.selectedIndex = imageListIndex
                    ImageSelect()
                    document.body.style.cursor = "default"
                }

                event.preventDefault()
            }else if (key === 39) {//按右键→
                if (imageList.length > 1) {
                    if(task == "classification" && classListIndex != -1){
						classList.options[classListIndex].selected = false
						setCurrentClass()
					}
					
					imageList.options[imageListIndex].selected = false

                    if (imageListIndex === imageList.length - 1) {
                        imageListIndex = 0
                    } else {
                        imageListIndex++
                    }
                    imageList.options[imageListIndex].selected = true
                    imageList.selectedIndex = imageListIndex
                    ImageSelect()
                    document.body.style.cursor = "default"
                }

                event.preventDefault()
            }else if (key === 38) {//按上键↑
                if (classList.length > 1) {
                    if (classListIndex === -1) {
						classListIndex = 0
					}else{
						classList.options[classListIndex].selected = false
						if (classListIndex === 0) {
							classListIndex = classList.length - 1
						} else {
							classListIndex--
						}
					}
                    classList.options[classListIndex].selected = true
                    ClassSelect()
                }else if(classList.length == 1) {//只有一个类
					if (classListIndex === -1) {classListIndex = 0}
                    classList.options[classListIndex].selected = true
                    ClassSelect()
				}
                event.preventDefault()
            }else if (key === 40) {//按下键↓
                if (classList.length > 1) {
					if (classListIndex === -1) {
						classListIndex = 0
					}else{
						classList.options[classListIndex].selected = false
						if (classListIndex === classList.length - 1) {
							classListIndex = 0
						} else {
							classListIndex++
						}
					}
                    classList.options[classListIndex].selected = true
                    ClassSelect()
                }else if(classList.length == 1) {//只有一个类
					if (classListIndex === -1) {classListIndex = 0}
                    classList.options[classListIndex].selected = true
                    ClassSelect()
				}
                event.preventDefault()
            }
			//if (key === 17){//按ctrl键
				
			//}
			FreshCanvas()
		})
    }

    const resetCanvasPlacement = () => {
        scale = defaultScale
        canvasX = 0
        canvasY = 0
        screenX = 0
        screenY = 0

        mouse.x = 0
        mouse.y = 0
        mouse.realX = 0
        mouse.realY = 0
        mouse.startRealX = 0
        mouse.startRealY = 0
    }

    const listenImageSearch = () => {
        document.getElementById("imageSearch").addEventListener("input", (event) => {
            const value = event.target.value

            for (let imageName in images) {
                if (imageName.indexOf(value) !== -1) {
                    document.getElementById("imageList").selectedIndex = images[imageName].index

                    ImageSelect(imageName)

                    break
                }
            }
			FreshCanvas()
        })
    }
	
	const ImageCrop = () => {
        const zip = new JSZip()
        let x = 0
        for (let imageName in bboxes) {
			const image = images[imageName]
			for (let className in bboxes[imageName]) {
                for (let i = 0; i < bboxes[imageName][className].length; i++) {
					x++
					if (x === 1) {
						document.body.style.cursor = "wait" // Mark as busy
                    }
					const bbox = bboxes[imageName][className][i]
					const reader = new FileReader()
					reader.readAsDataURL(image.meta)
					reader.addEventListener("load", () => {
						const dataUrl = reader.result
						const imageObject = new Image()
						imageObject.addEventListener("load", () => {
                            const temporaryCanvas = document.createElement("canvas")
                            temporaryCanvas.style.display = "none"
                            temporaryCanvas.width = bbox.width
                            temporaryCanvas.height = bbox.height
                            temporaryCanvas.getContext("2d").drawImage(
                                imageObject,
                                bbox.x,
                                bbox.y,
                                bbox.width,
                                bbox.height,
                                0,
                                0,
                                bbox.width,
                                bbox.height
                            )
							temporaryCanvas.toBlob((blob) => {
								const imageNameParts = imageName.split(".")
								imageNameParts[imageNameParts.length - 2] += `-${className}-${i}`
								zip.file(imageNameParts.join("."), blob)
								if (--x === 0) {
                                    document.body.style.cursor = "default"
									zip.generateAsync({type: "blob"})
                                        .then((blob) => {
                                            saveAs(blob, "crops.zip")
                                        })
                                }
                            }, image.meta.type)
                        })
                        imageObject.src = dataUrl
                    })
                }
            }
        }
    }
	
	const addclass = (c_value) => {
		var c = document.getElementById("class")
		var c_value = c_value ? c_value : c.value.trim()
		c.value=''
		if (c_value !== "" && Object.keys(classes).indexOf(c_value) == -1){
			var c_id = Object.keys(classes).length
			var color_this = document.getElementById("color").value
			var classList = document.getElementById("classList")
			classes[c_value] = c_id
			colors[c_value] = color_this //添加颜色
			var option = document.createElement("option")
			option.value = c_id
			option.innerHTML = c_value
			option.style.color = color_this
			if ((c_id === 0 || classList.selectedIndex == -1) && task !== "classification") {
				option.selected = true
			}
			classList.appendChild(option)
			setCurrentClass()		
		}else if(Object.keys(classes).indexOf(c_value) != -1){
			alert("不能添加重复类：" + c_value)
		}
		document.getElementById("modifyclasses").removeAttribute("hidden")
		document.getElementById("deleteclasses").removeAttribute("hidden")
		document.getElementById("deleteclasses_label").removeAttribute("hidden")
		document.getElementById("color").removeAttribute("hidden")
	}
	
	const modifyclass = (c_value) => {
		if(currentClass != null){
			var c = document.getElementById("class")
			var c_value = c_value ? c_value : c.value.trim()
			if(c_value != ""){
				c.value=''
				//修改calsses
				classes = modifykey(classes, currentClass, c_value)
				//修改colors
				colors = modifykey(colors, currentClass, c_value)
				//修改bboxes
				var bboxes_new = {}
				currentBbox = null//先清空currentBbox，避免出问题
				for(var imagename in bboxes){
					bboxes_new[imagename] = modifykey(bboxes[imagename], currentClass, c_value)//修改bboxes[imagename]里面对应的类名
				}
				bboxes = bboxes_new
				//修改options
				document.getElementById("classList").children[classListIndex].text = c_value
				//修改currentClass
				setCurrentClass()
				FreshCanvas()//修改了bboxes，因此需要刷新画布
			}
		}else{
			alert("请先选定要修改名字的类")
		}
	}
	
    const listenaddclasses = () => {
        document.getElementById("addclasses").addEventListener("click", () => {
            addclass()
        })
		
		document.getElementById("class").addEventListener("keydown", (event) => {
			if(event.keyCode == 13){
				addclass()
			}
        })
    }
	
	const listenmodifyclasses = () => {
        document.getElementById("modifyclasses").addEventListener("click", () => {
            modifyclass()
        })
    }
	
	
	const listendeleteclasses = () => {
        document.getElementById("deleteclasses").addEventListener("click", () => {
			var dclass = currentClass
			var deleteclass = () => {
				var classList = document.getElementById("classList")
				classList.options.remove(classListIndex)
				//classList.options[0].selected = true
				var classes_new = {}
				for(var key in classes){
					if(key!==dclass){
						if(classListIndex>classes[key]){
							classes_new[key]=classes[key]
						}else{
							classes_new[key]=classes[key]-1
						}
					}
				}
				setCurrentClass()
				classes = classes_new
			}
			const deletebbox = () => {
				//删除该分类的标注框，不需要删除颜色colors
				for (var imageName in bboxes) {
					bboxes[imageName] = deletekey(bboxes[imageName], dclass)
				}
				//没有标注框的图片，要在bboxes里面删除整个图片键值对
				bboxes_sort()
				set_imagestate()//设置图片状态，有标注框则变为蓝色，无则默认为黑色
			}
			if (dclass == null){
				alert("请先选择分类，再进行删除操作！")
			}else if(Object.keys(bboxes).length > 0){
				var r=confirm("删除分类会把该类已标注框一并删除，是否确定删除？");
				if (r==true){
					deleteclass()
					deletebbox()
				}
			}else{
				deleteclass()
				deletebbox()
			}
			FreshCanvas()
		})
    }
	
	const listenchangecolor = () => {
        document.getElementById("color").addEventListener("input", () => {
			if(classListIndex != -1){
				var option = document.getElementById("classList").children[classListIndex]
				var color_this = document.getElementById("color").value
				option.style.color = color_this
				colors[currentClass] = color_this
			}
			FreshCanvas()
		})
    }
	
	const rgbToRgba = (color, alp) => {
		var r, g, b, rgba;
		if(color.indexOf("#")!= -1){
			r = parseInt(color.substr(1, 2), 16)
			g = parseInt(color.substr(3, 2), 16)
			b = parseInt(color.substr(5, 2), 16)
		}else{
			var rgbaAttr = color.match(/[\d.]+/g);
			if (rgbaAttr.length >= 3){
				r = rgbaAttr[0];
				g = rgbaAttr[1];
				b = rgbaAttr[2];
			}
		}
		rgba = 'rgba(' + r + ',' + g + ',' + b + ',' + alp + ')'
		return rgba
	}
	
	const setCurrentColor = () => {
		document.getElementById("color").value = colors[currentClass]
	}
	
	const image_bboxes_zip = async(zip, flag) => {
		const zip_f = async(i, imageName) => {
			var image = images[imageName]
			var imageCanvas = document.createElement("canvas")
			var imageObject = new Image()
			var context = imageCanvas.getContext("2d")
            imageCanvas.style.display = "none"
			
			await promise_function(() => {imageObject.src = readers[i].result})//读取数据
			
			if(flag["flag_images"] == false || flag["flag_imagebboxes"] == false){//需要输出原始图象或带标注框图象
				imageCanvas.width = image.width//设置画布宽
				imageCanvas.height = image.height//设置画布高
				context.drawImage(imageObject,0,0, imageCanvas.width, imageCanvas.height)//在画布上画出原图
			}
			
			if(flag["flag_images"] == false){//需要输出原始图象
				var name = imageName.split(".")
				var path = images_foldername + "\\" + name[0] + "."  + name[1]
				await canvas_addToZip(imageCanvas, zip, path, image.meta.type)
				image_f = image_f + 1
				if(image_f == Object.keys(images).length){flag["flag_images"] = true}//原始图象搞定
			}
			
			if(flag["flag_imagebboxes"] == false){//需要输出带标注框图象
				fitZoom(image)
				for (var className in bboxes[imageName]) {
					var bboxs_this = bboxes[imageName][className]
					bboxs_this.forEach(bbox => {
						if(task == "classification"){
							setFontStyles_dezoom(context, false, colors[className], true, fontBaseSize * 2)
							context.fillText(className, bbox.width/2, bbox.height / 2)
						}else{
							setFontStyles_dezoom(context, false, colors[className], false)
							context.fillText(className, bbox.x, bbox.y)
						}
						setBBoxStyles(context, false, colors[className], rgbToRgba(colors[className], bboxalpha))
						context.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height)
						context.fillRect(bbox.x, bbox.y, bbox.width, bbox.height)
						//drawX(context, bbox.x, bbox.y, bbox.width, bbox.height)
					})
				}
				var name = imageName.split(".")
				var path = imagesbboxes_foldername + "\\" + name[0] + "." + name[1]
				await canvas_addToZip(imageCanvas, zip, path, image.meta.type)
				bboxes_f = bboxes_f + 1
				if(bboxes_f == Object.keys(images).length){flag["flag_imagebboxes"] = true}//带标注框图象搞定
			}	
			
			if(flag["flag_imagecrop"] == false){//需要输出标注分块图象
				for (var className in bboxes[imageName]) {
					var bboxes_i = 0
					for (var j = 0; j < bboxes[imageName][className].length; j++) {
						var bbox = bboxes[imageName][className][j]
						imageCanvas.width = bbox.width
						imageCanvas.height = bbox.height
						context.drawImage(
							imageObject,
							bbox.x, bbox.y,
							bbox.width, bbox.height,
							0, 0,
							bbox.width, bbox.height
						)
						var name = imageName.split(".")
						var path = imagescrop_foldername + "\\"
						if(crop_path_first == "name"){
							path = path + name[0] + "\\" + className + "_" + bboxes_i + "_" + bbox.x + "." + name[1]
						}else if(crop_path_first == "class"){
							path = path + className + "\\" + name[0] + "_" + bboxes_i + "_" + bbox.x  + "." + name[1]
						}else{
							path = path + name[0] + "-" + className + "_" + bboxes_i + "_" + bbox.x  + "." + name[1]
						}
						await canvas_addToZip(imageCanvas, zip, path, image.meta.type)
						bboxes_i = bboxes_i + 1
					}
				}
				crop_f = crop_f + 1
				if(crop_f == Object.keys(images).length){flag["flag_imagecrop"] = true}//标注分块图象搞定
			}
		}
		
		var image_o = document.getElementById("image_o").checked
		var image_bboxes = document.getElementById("image_bboxes").checked
		var images_crop = document.getElementById("crop_images").checked
		
		if(image_o == false){//不需要输出原始图象
			flag["flag_images"] = true
		}else{
			if(Object.keys(images).length <= 0){flag["flag_images"] = true}//当没有图象的时候直接go}
		}
		if(image_bboxes == false){//不需要输出带标注框图象时
			flag["flag_imagebboxes"] = true
		}else{
			if(Object.keys(bboxes).length <= 0){flag["flag_imagebboxes"] = true}//当没有标注框的时候直接go
		}
		if(images_crop == false){//不需要输出标注分块图象时
			flag["flag_imagecrop"] = true
		}else{
			if(Object.keys(bboxes).length <= 0){flag["flag_imagecrop"] = true}//当没有标注框的时候直接go
		}
		
		if(flag["flag_images"] == false || flag["flag_imagebboxes"] == false || flag["flag_imagecrop"] == false){//需要输出带标注框图象或原始图象或标注分块图象时，则进行操作
			var image_i = 0
			var image_f = 0//完成了原始图像处理的数目
			var bboxes_f = 0//完成了带标注框图象处理的数目
			var crop_f = 0//完成了标注分块处理的数目
			//var readers = new Array(Object.keys(images).length)
			var readers = []
			for (var imageName in images){
				var image = images[imageName]
				var reader = new FileReader()
				readers.push(reader)				
				readers[image_i].addEventListener("load", zip_f.bind(this, image_i, imageName))//fn.bind(this,argumens)方法,使得监听内函数不立即执行
				readers[image_i].readAsDataURL(image.meta)
				image_i = image_i + 1
			}
		}
    }
	
	const canvas_addToZip = async(canvas, zip, name, type) => {
		return new Promise((resolve, reject) => {
			canvas.toBlob(function (blob) {
				zip.file(name, blob);  // 将每次不同的canvas数据添加到zip文件中
				resolve();
			}, type);
		})
	}
	
	const promise_function  = async(fn) => {
		return new Promise((resolve, reject) => {
			fn()//要执行的函数
			resolve();
		})
	}
	
	const sleep = (delay) => {
		var start = (new Date()).getTime();
		while((new Date()).getTime() - start < delay) {
			continue;
		}
	}
	
	const showsave = () => {
		var savebr = document.getElementsByName("save_br")
		var sd = document.getElementsByName("saveDetection")
		var sc = document.getElementsByName("saveClassification")
		if(task == "detection"){
			savebr.forEach(br =>{br.removeAttribute("hidden")})
			sd.forEach(sd =>{sd.removeAttribute("hidden")})
			sd[0].checked = true
			sc.forEach(sc =>{
				sc.setAttribute("hidden", true)
				if(sc.type == "checkbox"){sc.checked = false}
			})
		}else if(task == "classification"){
			savebr.forEach(br =>{br.setAttribute("hidden", true)})
			sd.forEach(sd =>{
				sd.setAttribute("hidden", true)
				if(sd.type == "checkbox"){sd.checked = false}
			})
			sc[0].checked = true
			sc.forEach(sc =>{sc.removeAttribute("hidden")})
		}
	}
	
	const change_task = (task_change) => {
		task = task_change
		bboxes = {}//清空所有bboxes
		currentBbox = null
		showsave()//显示或隐藏相应的保存选项
		removelistenTask()//不再监听任务变化
		listenCanvasMouse()
		show_crop_imagebboxes()
		if(task == "classification"){unselectclass()}//不选择任何class，初始化
		set_imagestate()
	}
	
	const change_task_confirm = (e) => {
		var task_radio = e.target.value
		if (task != task_radio &&(task_radio == "detection" || task_radio == "classification")){
			var c = ""
			if(task_radio == "detection"){c = "确定设置为目标检测吗？（只能改变一次任务，如设置错误则需要重新进入页面；改变任务会删除所有已标注框）"}
			else if(task_radio == "classification"){c = "确定设置为图象分类吗？（只能改变一次任务，如设置错误则需要重新进入页面；改变任务会删除所有已标注框）"}
			if (confirm(c)==true){
				change_task(task_radio)
			}else{
				document.getElementsByName("task").forEach(task_i =>{task_i.checked = !task_i.checked})//单选框点击后就会触发状态改变，既然选择取消，就要反转回来
			}
		}
		FreshCanvas()
	}
	
	const listenTask = () => {
		//获取点击之前的task
		var task_o = document.getElementById("task")
		var task_r = document.getElementsByName("task")
		for(var n=0; n < task_r.length; n++){
			if(task_r[n].checked){
				task = task_r[n].value
				break
			}
		}
		show_crop_imagebboxes()
		task_o.addEventListener("click", change_task_confirm, event)
	}
	
	const removelistenCanvasMouse = () => {
        canvas.element.removeEventListener("mousemove", trackPointer, false)
        canvas.element.removeEventListener("mousedown", trackPointer, false)
        canvas.element.removeEventListener("mouseup", trackPointer, false)
        canvas.element.removeEventListener("mouseout", trackPointer, false)
    }
	
	const removelistenTask = () => {
		var task_o = document.getElementById("task")
		//确保显示选项为任务项
		var task_r = document.getElementsByName("task")
		for(var n=0; n < task_r.length; n++){
			if(task_r[n].value == task){task_r[n].checked = true}
			else{task_r[n].checked = false}
		}
		//取消监听并取消单选项
		document.getElementsByName("task").forEach(task_i => {task_i.setAttribute("disabled", true)})
		task_o.removeEventListener("click", change_task_confirm, false)
	}
	
	const unselectclass = () => {
		var classList =  document.getElementById("classList")
		var options = classList.children
		if(classList.selectedIndex != -1){
			options[classList.selectedIndex].selected = false
			setCurrentClass()
		}
	}
	
	const show_crop_imagebboxes = () => {
		var ci = document.getElementById("crop_images")
		var ib = document.getElementById("image_bboxes")
		if(task == "classification"){
			ci.checked = false
			ci.setAttribute("hidden", true)
			document.getElementById("crop_images_label").setAttribute("hidden", true)
		}else{
			ci.removeAttribute("hidden")
			document.getElementById("crop_images_label").removeAttribute("hidden")
		}
	}
	
	const deletekey = (dict, key_delete) => {//在键值对中删除某个键
		var dict_new ={}
		for (var key in dict) {
			if(key !== key_delete){//找到了要删除的键名
				dict_new[key] = dict[key]
			}
		}
		return dict_new
	}
	
	const modifykey = (dict, key_modify, key_new) => {//在键值对中修改某个键名
		var dict_new ={}
		for (var key in dict) {
			if(key !== key_modify){
				dict_new[key] = dict[key]
			}else{//找到了要修改的键名
				dict_new[key_new] = dict[key]
			}
		}
		return dict_new
	}
	
	const bboxes_sort = () => {//整理bbox，去重等
		var delete_image = []
		if (typeof(bboxes) != "undefined") {
			for (var imageName in bboxes) {//一个一个图片看
				var bbox_image = bboxes[imageName]
				if(typeof(bbox_image) != "undefined" && Object.keys(bbox_image).length > 0){//含类标注框数目大于0才有去重的必要
					var delete_class = []//登记需要删除的类
					for(var className in bbox_image){//一个一个类去看	
						var bbox_class = bbox_image[className]
						var bbox_class_new = []
						if(typeof(bbox_class) != "undefined" && bbox_class.length > 1){//有超过1个标注框以上，才需要去重
							var bbox_strings = []//将标注框转换为字符串，便于去重
							for(var i = 0; i < bbox_class.length; i++){//一个一个标注框看
								var bbox_string_this = bbox_class[i].x + "-" + bbox_class[i].y + "-" + 
									bbox_class[i].width + "-" + bbox_class[i].height
								if(bbox_strings.indexOf(bbox_string_this) == -1){//不是重复的
									bbox_class_new.push(bbox_class[i])
									bbox_strings.push(bbox_string_this)
								}
							}
							bbox_class = bbox_class_new//处理完一个类的标注框
						}
						//处理完以后，把多余的没有标注框的类记录下来，之后删除
						if(typeof(bbox_class) == "undefined" || bbox_class.length == 0){
							delete_class.push(className)
						}
						bbox_image[className] = bbox_class
					}
					//删除多余的没有标注框的类
					for(var i = 0; i < delete_class.length; i++){
						bbox_image = deletekey(bbox_image, delete_class[i])
					}
					bboxes[imageName] = bbox_image
				}
				//处理完以后，把多余的没有标注框的图片记录下来，之后删除
				if(typeof(bbox_image) == "undefined" || Object.keys(bbox_image).length == 0){
					delete_image.push(imageName)
				}
				bboxes[imageName] = bbox_image
			}
		}
		//删除多余的没有标注框的图片
		for(var i = 0; i < delete_image.length; i++){
			bboxes = deletekey(bboxes, delete_image[i])
		}
	}
	
	const addclassoptions_fromclasses = () => {
		var classList = document.getElementById("classList")
		for(var c in classes){
			var option = document.createElement("option")
			var c_id = classes[c]
			option.value = c_id
			option.innerHTML = c
			option.style.color = colors[c]
			if ((c_id === 0 || classList.selectedIndex == -1) && task !== "classification") {
				option.selected = true
			}else if(c == Object.keys(bboxes[Object.keys(images)[0]])[0] && task == "classification"){
				//导入本地缓存之后默认呈现的肯定是第一张图片，所以找到bboxes里面第一张图片对应的类就好
				option.selected = true
			}
			classList.appendChild(option)
		}
		setCurrentClass()
	}
})()
