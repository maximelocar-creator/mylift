// UI MyLift sur mesure pour la Live Activity (remplace celle du package via
// patch-package — les STRUCTS restent identiques au module JS, seul le
// rendu SwiftUI change).
//
// Île compacte : « MyLift » côté caméra · timer réel (0:00 si aucun repos)
// + anneau orange qui se remplit sur la fenêtre de repos côté droit.
// Île étendue / écran verrouillé : marque, exo + cible + machine (sous-titre
// fourni par l'app), grand timer, barre orange, boutons Start/Pause/Reset
// (deep links mylift://timer/… interceptés par l'app).
import ActivityKit
import SwiftUI
import WidgetKit

struct LiveActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var subtitle: String?
    var timerEndDateInMilliseconds: Double?
    var timerStartDateInMilliseconds: Double?
    var progress: Double?
    var imageName: String?
    var dynamicIslandImageName: String?
  }

  var name: String
  var backgroundColor: String?
  var titleColor: String?
  var subtitleColor: String?
  var progressViewTint: String?
  var progressViewLabelColor: String?
  var deepLinkUrl: String?
  var timerType: DynamicIslandTimerType?
  var padding: Int?
  var paddingDetails: PaddingDetails?
  var imagePosition: String?
  var imageWidth: Int?
  var imageHeight: Int?
  var imageWidthPercent: Double?
  var imageHeightPercent: Double?
  var imageAlign: String?
  var contentFit: String?

  enum DynamicIslandTimerType: String, Codable {
    case circular
    case digital
  }

  struct PaddingDetails: Codable, Hashable {
    var top: Int?
    var bottom: Int?
    var left: Int?
    var right: Int?
    var vertical: Int?
    var horizontal: Int?
  }
}

// Scheme de l'app (mylift) lu dans l'Info.plist de l'extension
let myliftScheme: String = {
  guard
    let urlTypes = Bundle.main.infoDictionary?["CFBundleURLTypes"] as? [[String: Any]],
    let schemes = urlTypes.first?["CFBundleURLSchemes"] as? [String],
    let firstScheme = schemes.first
  else {
    return "mylift"
  }
  return firstScheme
}()

func myliftURL(_ path: String) -> URL {
  URL(string: myliftScheme + "://" + path) ?? URL(string: "mylift://" + path)!
}

let myliftCoral = Color(red: 252 / 255, green: 76 / 255, blue: 2 / 255)

// Marque « MyLift » (My blanc · Lift coral)
struct MyLiftMark: View {
  var size: CGFloat = 12
  var body: some View {
    (Text("My").foregroundColor(.white) + Text("Lift").foregroundColor(myliftCoral))
      .font(.system(size: size, weight: .heavy))
      .lineLimit(1)
      .minimumScaleFactor(0.6)
  }
}

// Timer : temps de repos PRIS (compte vers le haut depuis le début du repos),
// non borné. 0:00 fixe hors repos.
struct RestTimerText: View {
  let startDate: Double?
  var size: CGFloat = 15
  var body: some View {
    Group {
      if let startDate {
        Text(
          timerInterval: Date(timeIntervalSince1970: startDate / 1000) ... Date.distantFuture,
          countsDown: false
        )
        .multilineTextAlignment(.trailing)
      } else {
        Text("0:00")
      }
    }
    .font(.system(size: size, weight: .semibold).monospacedDigit())
    .foregroundColor(.white)
    .lineLimit(1)
    .minimumScaleFactor(0.7)
  }
}

// Anneau orange : se remplit sur la fenêtre de repos (2 min par défaut)
struct RestRing: View {
  let endDate: Double?
  var body: some View {
    Group {
      if let endDate {
        ProgressView(
          timerInterval: Date.toTimerInterval(miliseconds: endDate),
          countsDown: false,
          label: { EmptyView() },
          currentValueLabel: { EmptyView() }
        )
        .progressViewStyle(.circular)
      } else {
        Circle()
          .stroke(myliftCoral.opacity(0.35), lineWidth: 2.5)
      }
    }
    .tint(myliftCoral)
    .frame(width: 18, height: 18)
  }
}

// Boutons de contrôle du timer (deep links interceptés par l'app)
struct TimerControls: View {
  let timerRunning: Bool
  var body: some View {
    HStack(spacing: 8) {
      if timerRunning {
        controlLink(path: "timer/stop", icon: "pause.fill", label: "Pause")
      } else {
        controlLink(path: "timer/start", icon: "play.fill", label: "Repos")
      }
      controlLink(path: "timer/reset", icon: "arrow.counterclockwise", label: "Reset")
    }
  }

  private func controlLink(path: String, icon: String, label: String) -> some View {
    Link(destination: myliftURL(path)) {
      HStack(spacing: 5) {
        Image(systemName: icon).font(.system(size: 11, weight: .bold))
        Text(label).font(.system(size: 12, weight: .bold))
      }
      .foregroundColor(myliftCoral)
      .padding(.vertical, 7)
      .padding(.horizontal, 12)
      .background(Capsule().fill(myliftCoral.opacity(0.18)))
    }
  }
}

struct LiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiveActivityAttributes.self) { context in
      LiveActivityView(contentState: context.state, attributes: context.attributes)
        .activityBackgroundTint(
          context.attributes.backgroundColor.map { Color(hex: $0) } ?? Color(red: 0.04, green: 0.04, blue: 0.07)
        )
        .activitySystemActionForegroundColor(myliftCoral)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading, priority: 1) {
          VStack(alignment: .leading, spacing: 2) {
            MyLiftMark(size: 11)
            Text(context.state.title)
              .font(.system(size: 17, weight: .bold))
              .foregroundColor(.white)
              .lineLimit(1)
              .minimumScaleFactor(0.75)
            if let subtitle = context.state.subtitle {
              Text(subtitle)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.white.opacity(0.7))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            }
          }
          .padding(.leading, 4)
          .dynamicIsland(verticalPlacement: .belowIfTooWide)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
        DynamicIslandExpandedRegion(.trailing) {
          VStack(alignment: .trailing, spacing: 2) {
            RestTimerText(startDate: context.state.timerStartDateInMilliseconds, size: 24)
            Text("repos")
              .font(.system(size: 10, weight: .semibold))
              .foregroundColor(.white.opacity(0.55))
              .textCase(.uppercase)
          }
          .padding(.trailing, 6)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: 10) {
            if let date = context.state.timerEndDateInMilliseconds {
              ProgressView(timerInterval: Date.toTimerInterval(miliseconds: date))
                .labelsHidden()
                .tint(myliftCoral)
            } else {
              ProgressView(value: context.state.progress ?? 0)
                .labelsHidden()
                .tint(myliftCoral)
            }
            TimerControls(timerRunning: context.state.timerEndDateInMilliseconds != nil)
          }
          .padding(.horizontal, 4)
          .padding(.top, 4)
        }
      } compactLeading: {
        MyLiftMark(size: 12)
          .padding(.leading, 2)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
      } compactTrailing: {
        HStack(spacing: 5) {
          RestTimerText(startDate: context.state.timerStartDateInMilliseconds, size: 14)
            .frame(maxWidth: 48)
          RestRing(endDate: context.state.timerEndDateInMilliseconds)
        }
        .applyWidgetURL(from: context.attributes.deepLinkUrl)
      } minimal: {
        RestRing(endDate: context.state.timerEndDateInMilliseconds)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
      }
    }
  }
}
