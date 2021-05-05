import React from 'react'

export default class ASR extends React.Component {
  setupDataChannelHandler = (dc = new RTCDataChannel()) => {
    dc.onclose = () => this.setState({ isConnected: false })
    dc.onopen = () => this.setState({ isConnected: true })

    dc.onmessage = (e) => {
      const msg = e.data
      // if (msg.endsWith('\n')) return this.execute()
      const isReplacingLine = msg.endsWith('\r') || msg.endsWith('\n')
      const trimmedMessage = msg.trim()
      this.setState({
        _buffered: isReplacingLine ? '' : this.state._buffered + trimmedMessage,
        recognisedText: this.state._buffered + trimmedMessage,
      })
    }
  }

  setupPeerConnectionHandler = (pc = new RTCPeerConnection()) => {
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected')
        this.setState({
          isConnected: false,
        })
    }
  }

  connect = async (pc = new RTCPeerConnection()) => {
    const offer = pc.localDescription
    const answer = await fetch('/offer', {
      body: JSON.stringify({
        sdp: offer.sdp,
        type: offer.type,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }).then((r) => r.json())

    pc.setRemoteDescription(answer)
    return answer
  }

  tryConnect = async (pc = new RTCPeerConnection()) => {
    if (this.state.isConnected) return true
    if (pc.iceGatheringState === 'complete') {
      await this.connect(pc)
      return true
    }
    return false
  }

  negotiate = async (pc = new RTCPeerConnection(), restart = false) => {
    const offer = await pc.createOffer({ iceRestart: restart })
    await pc.setLocalDescription(offer)
    if (!(await this.tryConnect(pc)))
      pc.addEventListener(
        'icegatheringstatechange',
        async () => await this.tryConnect(pc),
      )
  }

  setupNewConnectionAndChannel = () => {
    'โกวาจี จะพระราชทานพระบรมราชานุญาตให้ข้าพระพุทธเจ้าดูหีท่านแต่โดยละมุนละม่อมไหม'

    const peerConnection = new RTCPeerConnection({
      sdpSemantics: 'unified-plan',
    })
    const dataChannel = peerConnection.createDataChannel(peerConnection)

    return [peerConnection, dataChannel]
  }
  constructor() {
    super()

    const [peerConnection, dataChannel] = this.setupNewConnectionAndChannel()

    this.setupDataChannelHandler(dataChannel)
    this.setupPeerConnectionHandler(peerConnection)

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then(async (stream) => {
        stream
          .getTracks()
          .forEach((track) => peerConnection.addTrack(track, stream))
        await this.negotiate(peerConnection)
      })

    this.state = {
      peerConnection,
      dataChannel,
      isConnected: false,
      recognisedText: '',
      _buffered: '',
      recogHistory: [],
    }
  }

  execute = () => {
    const pc = this.state.peerConnection,
      dc = this.state.dataChannel
    this.closePeerConnection(pc, dc)

    if (this.props.voiceHandler != undefined)
      this.props.voiceHandler(this.state.recognisedText)

    const [peerConnection, dataChannel] = this.setupNewConnectionAndChannel()
    this.setupDataChannelHandler(dataChannel)
    this.setupPeerConnectionHandler(peerConnection)

    this.setState({
      recognisedText: '',
      _buffered: '',
      recogHistory: [...this.state.recogHistory, this.state.recognisedText],
      isConnected: false,
      peerConnection,
      dataChannel,
    })

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then(async (stream) => {
        stream
          .getTracks()
          .forEach((track) => peerConnection.addTrack(track, stream))
        await this.negotiate(peerConnection)
      })
  }

  closePeerConnection = (peerConnection, dataChannel) => {
    if (dataChannel) {
      dataChannel.close()
    }

    // close transceivers
    if (peerConnection.getTransceivers)
      peerConnection
        .getTransceivers()
        .forEach((transceiver) => transceiver.stop())

    // close local audio / video
    peerConnection.getSenders().forEach((sender) => sender.track.stop())

    // close peer connection
    setTimeout(() => peerConnection.close(), 500)
  }
  render() {
    return (
      <>
        {this.state.recogHistory.map((sentence, i) => (
          <p key={`sentence-${i}`}>{sentence}</p>
        ))}
        <p>Currently Recognise: {this.state.recognisedText} </p>
        <button onClick={this.execute}>Cut-off</button>
      </>
    )
  }
}
