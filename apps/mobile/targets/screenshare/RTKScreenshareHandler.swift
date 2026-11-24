import ReplayKit

open class RTKScreenshareHandler: RPBroadcastSampleHandler {
    
    private var clientConnection: RTKSocketConnection?
    private var uploader: RTKScreenshareUploader?
    private var frameCount: Int = 0
    
    private let appGroupIdentifier: String
    private let bundleIdentifier: String
    
    public override init() {
        appGroupIdentifier = ""
        bundleIdentifier = ""
        super.init()
    }
    
    public init(appGroupIdentifier: String, bundleIdentifier: String) {
        self.appGroupIdentifier = appGroupIdentifier
        self.bundleIdentifier = bundleIdentifier
        super.init()
        if let connection = RTKSocketConnection(filePath: socketFilePath) {
            clientConnection = connection
            setupConnection()
            uploader = RTKScreenshareUploader(connection: connection, bundleIdentifier: bundleIdentifier)
        }
    }
    
    private var socketFilePath: String {
        let sharedContainer = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)
        return sharedContainer?.appendingPathComponent("rtc_SSFD").path ?? ""
    }
    
    public override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        // User has requested to start the broadcast. Setup info from the UI extension can be supplied but optional.
        frameCount = 0
        RTKDarwinNotificationCenter.shared.postNotification(.broadcastStarted)
        openConnection()
    }
    
    public override func broadcastPaused() {
        // User has requested to pause the broadcast. Samples will stop being delivered.
    }
    
    public override func broadcastResumed() {
        // User has requested to resume the broadcast. Samples delivery will resume.
    }
    
    public override func broadcastFinished() {
        // User has requested to finish the broadcast.
        RTKDarwinNotificationCenter.shared.postNotification(.broadcastStopped)
        clientConnection?.close()
    }
    
    override public func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        switch sampleBufferType {
        case RPSampleBufferType.video:
            frameCount += 1
            uploader?.send(sample: sampleBuffer)
           if frameCount % 3 == 0 {
               uploader?.send(sample: sampleBuffer)
           }
        default:
            break
        }
    }
}

private extension RTKScreenshareHandler {
  
    func setupConnection() {
        clientConnection?.didClose = { [weak self] error in
            print("[RTK][DEBUG] client connection did close \(String(describing: error))")
          
            if let error = error {
                self?.finishBroadcastWithError(error)
            } else {
                // the displayed failure message is more user friendly when using NSError instead of Error
                let RTKScreenSharingStopped = 10001
                let customError = NSError(domain: RPRecordingErrorDomain, code: RTKScreenSharingStopped, userInfo: [NSLocalizedDescriptionKey: "Screen sharing stopped"])
                self?.finishBroadcastWithError(customError)
            }
        }
    }
    
    func openConnection() {
        let queue = DispatchQueue(label: "broadcast.connectTimer")
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now(), repeating: .milliseconds(100), leeway: .milliseconds(500))
        timer.setEventHandler { [weak self] in
            guard self?.clientConnection?.open() == true else {
                return
            }
            
            timer.cancel()
        }
        
        timer.resume()
    }
}

