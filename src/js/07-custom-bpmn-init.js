function extractBizagiExtensions (businessObject) {
  const extensions = {
    entradas: '',
    saidas: '',
    ferramentas: '',
  }

  const extensionElements = businessObject?.extensionElements?.values
  if (!extensionElements) return extensions

  const bizagiExtensions = extensionElements.find((ext) =>
    ext.$type === 'bizagi:BizagiExtensions'
  )

  if (!bizagiExtensions) return extensions

  // Look for BizagiExtendedAttributeValues in the $children array
  const extendedAttributeValuesElement = bizagiExtensions.$children?.find((child) =>
    child.$type === 'bizagi:BizagiExtendedAttributeValues'
  )

  if (!extendedAttributeValuesElement || !extendedAttributeValuesElement.$children) return extensions

  const attributeValues = extendedAttributeValuesElement.$children.filter((child) =>
    child.$type === 'bizagi:BizagiExtendedAttributeValue'
  )

  if (!attributeValues || attributeValues.length === 0) return extensions

  attributeValues.forEach((attr) => {
    // Get the ID from attributes
    const attrId = attr.Id || attr.id || attr.$attrs?.Id

    // Find the Content element in $children
    const contentElement = attr.$children?.find((child) =>
      child.$type === 'bizagi:Content'
    )
    const attrContent = contentElement?.$body || contentElement?.content || ''

    if (attrId === 'e95774fc-391f-437f-9242-6f8487bab3ec') {
      extensions.entradas = attrContent || ''
    } else if (attrId === 'c395f188-436d-43f8-90ef-a44e424a0aee') {
      extensions.saidas = attrContent || ''
    } else if (attrId === '1d785299-4383-4fc0-8dfa-e645f355fa41') {
      extensions.ferramentas = attrContent || ''
    }
  })
  return extensions
}

function createExtensionSection (title, content) {
  if (!content || content.trim() === '') return ''

  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = content
  const cleanContent = tempDiv.innerHTML

  return `
    <div class="bpmn-extension-section">
      <h4 class="bpmn-extension-title">${title}</h4>
      <div class="bpmn-extension-content">${cleanContent}</div>
    </div>
  `
}

function setupDocumentationDisplay (viewer, containerId) {
  const eventBus = viewer.get('eventBus')
  const overlays = viewer.get('overlays')
  let currentOverlayId = null
  const diagramContainer = document.getElementById(containerId)

  eventBus.on('element.click', function (event) {
    const element = event.element
    const businessObject = element.businessObject

    if (currentOverlayId) {
      try {
        overlays.remove(currentOverlayId)
      } catch (e) { /* ignore */
      }
      currentOverlayId = null
    }

    let overlayContent = ''

    if (businessObject && businessObject.documentation && businessObject.documentation.length > 0) {
      // Handle BPMN 2.0 documentation format - documentation is an array of objects
      const docElement = businessObject.documentation[0]
      let docHtml = ''
      if (typeof docElement === 'string') {
        docHtml = docElement
      } else if (docElement && docElement.text) {
        docHtml = docElement.text
      } else if (docElement && docElement.$body) {
        docHtml = docElement.$body
      }
      if (docHtml && docHtml.trim() !== '') {
        // Decode HTML entities if present
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = docHtml
        const cleanDocHtml = tempDiv.innerHTML
        overlayContent += `<div class="bpmn-documentation">${cleanDocHtml}</div>`
      }
    }

    // Extract and add Bizagi extensions
    const extensions = extractBizagiExtensions(businessObject)
    const extensionSections = [
      createExtensionSection('Entradas', extensions.entradas),
      createExtensionSection('Saídas', extensions.saidas),
      createExtensionSection('Ferramentas', extensions.ferramentas),
    ].filter((section) => section !== '').join('')

    if (extensionSections) {
      overlayContent += `<div class="bpmn-extensions">${extensionSections}</div>`
    }

    if (overlayContent) {
      currentOverlayId = overlays.add(element.id, 'documentation', {
        position: { bottom: 15, left: 0 },
        html: `<div class="bpmn-documentation-overlay">${overlayContent}</div>`,
        show: { minZoom: 0.4 },
      })
    }
  })

  // Optional: Close overlay when clicking outside an element
  diagramContainer.addEventListener('click', (event) => {
    if (event.target === diagramContainer && currentOverlayId) {
      try {
        overlays.remove(currentOverlayId)
      } catch (e) { /* ignore */
      }
      currentOverlayId = null
    }
  })
}

async function initializeBpmnViewer (containerId, diagramPath) {
  const viewer = new window.BpmnJS({ container: `#${containerId}` })
  const containerElement = document.getElementById(containerId)

  // Store viewer reference for fullscreen functionality
  containerElement._bpmnViewer = viewer

  try {
    const response = await window.fetch(diagramPath)
    if (!response.ok) {
      throw new Error(`Erro ao carregar o XML do BPMN (${response.status}): ${diagramPath}`)
    }
    const bpmnXML = await response.text()
    await viewer.importXML(bpmnXML)
    viewer.get('canvas').zoom('fit-viewport')
    setupDocumentationDisplay(viewer, containerId)
  } catch (err) {
    console.error('Erro na exibição do diagrama BPMN:', diagramPath, err)
    if (containerElement) {
      containerElement.innerHTML = `<p style="color:red;">Erro ao carregar o diagrama: ${err.message}</p>`
    }
  }
}

function setupFullscreenControls () {
  document.addEventListener('click', (event) => {
    if (event.target.classList.contains('bpmn-fullscreen-btn')) {
      const targetId = event.target.dataset.target
      const wrapper = event.target.closest('.bpmn-wrapper')
      const container = document.getElementById(targetId)

      if (wrapper.classList.contains('bpmn-fullscreen')) {
        // Exit fullscreen
        wrapper.classList.remove('bpmn-fullscreen')
        event.target.textContent = '⛶'
        event.target.title = 'Visualizar em tela cheia'
        document.body.style.overflow = ''
      } else {
        // Enter fullscreen
        wrapper.classList.add('bpmn-fullscreen')
        event.target.textContent = '⛷'
        event.target.title = 'Sair da tela cheia'
        document.body.style.overflow = 'hidden'
      }

      // Trigger canvas resize after fullscreen toggle
      if (container && container._bpmnViewer) {
        setTimeout(() => {
          container._bpmnViewer.get('canvas').resized()
          container._bpmnViewer.get('canvas').zoom('fit-viewport')
        }, 100)
      }
    }
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const fullscreenWrapper = document.querySelector('.bpmn-fullscreen')
      if (fullscreenWrapper) {
        const btn = fullscreenWrapper.querySelector('.bpmn-fullscreen-btn')
        if (btn) btn.click()
      }
    }
  })
}

document.addEventListener('DOMContentLoaded', () => {
  const bpmnContainers = document.querySelectorAll('.bpmn-diagram-container')
  bpmnContainers.forEach(async (container) => {
    const diagramPath = container.dataset.bpmnXmlPath
    const containerId = container.id
    if (diagramPath && containerId && !diagramPath.startsWith('ERROR_RESOLVING_')) {
      await initializeBpmnViewer(containerId, diagramPath)
    } else if (diagramPath && diagramPath.startsWith('ERROR_RESOLVING_')) {
      container.innerHTML = '<p style="color:red;">Erro: Não foi possível resolver o caminho para o diagrama BPMN: ' +
        `${diagramPath.substring('ERROR_RESOLVING_'.length)}</p>`
    }
  })

  setupFullscreenControls()
})
