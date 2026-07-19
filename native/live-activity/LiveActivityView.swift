// Écran verrouillé MyLift (remplace la vue du package via patch-package).
// Marque MyLift · exo en cours · cible + machine (sous-titre fourni par
// l'app) · grand timer (0:00 fixe hors repos) · barre orange · boutons
// Start/Pause/Reset (deep links interceptés par l'app).
import SwiftUI
import WidgetKit

#if canImport(ActivityKit)

  struct LiveActivityView: View {
    let contentState: LiveActivityAttributes.ContentState
    let attributes: LiveActivityAttributes

    var body: some View {
      VStack(alignment: .leading, spacing: 10) {
        HStack {
          MyLiftMark(size: 13)
          Spacer()
          Image(systemName: "dumbbell.fill")
            .font(.system(size: 13, weight: .bold))
            .foregroundColor(myliftCoral)
        }

        HStack(alignment: .center, spacing: 12) {
          VStack(alignment: .leading, spacing: 3) {
            Text(contentState.title)
              .font(.system(size: 19, weight: .bold))
              .foregroundColor(.white)
              .lineLimit(1)
              .minimumScaleFactor(0.75)
            if let subtitle = contentState.subtitle {
              Text(subtitle)
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(.white.opacity(0.7))
                .lineLimit(2)
                .minimumScaleFactor(0.8)
            }
          }
          Spacer()
          RestTimerText(endDate: contentState.timerEndDateInMilliseconds, size: 30)
        }

        if let date = contentState.timerEndDateInMilliseconds {
          ProgressView(timerInterval: Date.toTimerInterval(miliseconds: date))
            .labelsHidden()
            .tint(myliftCoral)
        } else {
          ProgressView(value: contentState.progress ?? 0)
            .labelsHidden()
            .tint(myliftCoral)
        }

        TimerControls(timerRunning: contentState.timerEndDateInMilliseconds != nil)
      }
      .padding(16)
    }
  }

#endif
