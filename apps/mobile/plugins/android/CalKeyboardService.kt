package com.calcom.companion.keyboard

import android.graphics.Color
import android.inputmethodservice.InputMethodService
import android.view.Gravity
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONObject
import java.io.File

private data class KeyboardSlot(val start: String, val label: String, val url: String)
private data class KeyboardDay(val date: String, val label: String, val slots: List<KeyboardSlot>)
private data class KeyboardLink(
    val id: String,
    val title: String,
    val url: String,
    val durationLabel: String?,
    val days: List<KeyboardDay>
)
private data class KeyboardData(
    val links: List<KeyboardLink>,
    val timeZone: String
)

class CalKeyboardService : InputMethodService() {
    private var data: KeyboardData? = null
    private var selectedLink: KeyboardLink? = null
    private val selectedSlots = linkedSetOf<String>()

    override fun onStartInputView(info: android.view.inputmethod.EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        data = readData()
        selectedLink = null
        selectedSlots.clear()
        showLinks()
    }

    private fun readData(): KeyboardData? {
        return try {
            val root = JSONObject(File(filesDir, "cal-keyboard.json").readText())
            val links = root.optJSONArray("links") ?: return null
            val parsedLinks = buildList {
                for (index in 0 until links.length()) {
                    val link = links.getJSONObject(index)
                    val days = link.optJSONArray("days") ?: continue
                    val parsedDays = buildList {
                        for (dayIndex in 0 until days.length()) {
                            val day = days.getJSONObject(dayIndex)
                            val slots = day.optJSONArray("slots") ?: continue
                            val parsedSlots = buildList {
                                for (slotIndex in 0 until slots.length()) {
                                    val slot = slots.getJSONObject(slotIndex)
                                    add(
                                        KeyboardSlot(
                                            slot.getString("start"),
                                            slot.getString("label"),
                                            slot.getString("url")
                                        )
                                    )
                                }
                            }
                            add(
                                KeyboardDay(
                                    day.getString("date"),
                                    day.getString("label"),
                                    parsedSlots
                                )
                            )
                        }
                    }
                    add(
                        KeyboardLink(
                            link.getString("id"),
                            link.getString("title"),
                            link.getString("url"),
                            link.optString("durationLabel").takeUnless { it == "null" || it.isEmpty() },
                            parsedDays
                        )
                    )
                }
            }
            KeyboardData(parsedLinks, root.optString("timeZone"))
        } catch (_: Exception) {
            null
        }
    }

    private fun baseLayout(): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(8), dp(8), dp(8), dp(8))
            setBackgroundColor(Color.rgb(245, 245, 245))
        }
    }

    private fun showLinks() {
        val layout = baseLayout()
        val title = TextView(this).apply {
            text = "Cal.com links"
            textSize = 18f
            setTextColor(Color.BLACK)
        }
        layout.addView(title)
        val links = data?.links.orEmpty()
        if (links.isEmpty()) {
            layout.addView(message("Open the Cal.com app to sync your links"))
        } else {
            val scroll = ScrollView(this)
            val list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
            links.forEach { link ->
                val button = Button(this).apply {
                    text = link.durationLabel?.let { "${link.title} ($it)" } ?: link.title
                    setOnClickListener {
                        selectedLink = link
                        selectedSlots.clear()
                        showSlots()
                    }
                }
                list.addView(button)
            }
            scroll.addView(list)
            layout.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        }
        addFooter(layout)
        setInputView(layout)
    }

    private fun showSlots() {
        val link = selectedLink ?: return
        val layout = baseLayout()
        val header = LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
        }
        header.addView(Button(this).apply {
            text = "Back"
            setOnClickListener { showLinks() }
        })
        header.addView(TextView(this).apply {
            text = link.title
            textSize = 18f
            setTextColor(Color.BLACK)
            setPadding(dp(8), 0, 0, 0)
        }, LinearLayout.LayoutParams(0, -2, 1f))
        header.addView(Button(this).apply {
            text = "Insert"
            isEnabled = false
            tag = "insert"
            setOnClickListener {
                currentInputConnection?.commitText(composeInsertion(link), 1)
                selectedSlots.clear()
                showLinks()
            }
        })
        layout.addView(header)

        val scroll = ScrollView(this)
        val list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        link.days.forEach { day ->
            list.addView(TextView(this).apply {
                text = day.label
                textSize = 15f
                setTextColor(Color.DKGRAY)
                setPadding(0, dp(8), 0, dp(2))
            })
            day.slots.forEach { slot ->
                val checkBox = CheckBox(this).apply {
                    text = slot.label
                    isChecked = selectedSlots.contains(slot.start)
                    setOnCheckedChangeListener { _, checked ->
                        if (checked) selectedSlots.add(slot.start) else selectedSlots.remove(slot.start)
                        header.findViewWithTag<Button>("insert").isEnabled = selectedSlots.isNotEmpty()
                    }
                }
                list.addView(checkBox)
            }
        }
        scroll.addView(list)
        layout.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        addFooter(layout)
        setInputView(layout)
    }

    private fun addFooter(layout: LinearLayout) {
        val footer = LinearLayout(this).apply {
            gravity = Gravity.RIGHT
        }
        val switchButton = Button(this).apply {
            text = "🌐"
            setOnClickListener {
                if (!switchToNextInputMethod(false)) {
                    (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager)
                        .showInputMethodPicker()
                }
            }
        }
        footer.addView(switchButton)
        footer.addView(Button(this).apply {
            text = "⌫"
            setOnClickListener { currentInputConnection?.deleteSurroundingText(1, 0) }
        })
        layout.addView(footer)
    }

    private fun composeInsertion(link: KeyboardLink): String {
        val selections = link.days.flatMap { day ->
            day.slots.filter { selectedSlots.contains(it.start) }.map { day to it }
        }
        val lines = selections.map { (day, slot) -> "${day.label} at ${slot.label} — ${slot.url}" }
        if (lines.size == 1) return lines[0]
        return (listOf("${link.title} — pick a time:") + lines + listOf("", "(times in ${data?.timeZone.orEmpty()})"))
            .joinToString("\n")
    }

    private fun message(text: String): TextView {
        return TextView(this).apply {
            this.text = text
            textSize = 15f
            gravity = Gravity.CENTER
            setTextColor(Color.DKGRAY)
            setPadding(dp(8), dp(16), dp(8), dp(16))
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
