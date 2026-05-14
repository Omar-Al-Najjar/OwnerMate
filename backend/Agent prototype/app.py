import pandas as pd
import streamlit as st
from collections import defaultdict

from pipeline import run_analysis

# ── Page Config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="OwnerMate AI",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Custom CSS ────────────────────────────────────────────────────────────────
st.markdown(
    """
    <style>
    .priority-high   { background:#fde8e8; border-left:4px solid #e53e3e; padding:12px 16px; border-radius:6px; margin-bottom:8px; }
    .priority-medium { background:#fef3cd; border-left:4px solid #d69e2e; padding:12px 16px; border-radius:6px; margin-bottom:8px; }
    .priority-low    { background:#e8f5e9; border-left:4px solid #38a169; padding:12px 16px; border-radius:6px; margin-bottom:8px; }
    .section-header  { font-size:1.1rem; font-weight:600; margin-bottom:4px; }
    .label           { font-size:0.78rem; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:.05em; margin-top:10px; margin-bottom:2px; }
    </style>
    """,
    unsafe_allow_html=True,
)

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## ⚙️ Configuration")
    st.markdown("---")

    api_key = st.text_input(
        "OpenAI API Key",
        type="password",
        placeholder="sk-...",
        help="Your OpenAI API key. It is only used to call the OpenAI API and is never stored.",
    )

    st.markdown("---")
    st.markdown(
        """
        **How it works**

        1. 🗂 **Semantic layer** — understands every column  
        2. ❓ **Question agent** — generates 15+ analytical questions  
        3. 🔍 **SQL agent** — writes & executes pandas queries  
        4. 📊 **Insights agent** — translates results into business language  
        5. ✅ **Refinement agent** — reviews and improves the output  

        ---
        **Typical runtime:** 3 – 8 minutes  
        **Model used:** GPT-4o
        """
    )

# ── Header ────────────────────────────────────────────────────────────────────
st.title("📊 OwnerMate AI — Business Data Analyst")
st.markdown(
    "Upload any business CSV and get a complete AI-powered analysis: "
    "data insights, prioritised action items, and risk warnings — written in plain English."
)
st.markdown("---")

# ── File Upload ───────────────────────────────────────────────────────────────
uploaded_file = st.file_uploader(
    "Upload your business data (CSV)",
    type=["csv"],
    help="Any CSV with business data works — sales, transactions, customer records, inventory, etc.",
)

if uploaded_file is not None:
    # Load dataframe
    df = pd.read_csv(uploaded_file)

    # Quick stats
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Rows", f"{len(df):,}")
    col2.metric("Columns", len(df.columns))
    col3.metric("Missing Values", f"{df.isnull().sum().sum():,}")
    col4.metric("Memory", f"{df.memory_usage(deep=True).sum() / 1024:.1f} KB")

    with st.expander("📋 Data Preview (first 10 rows)", expanded=True):
        st.dataframe(df.head(10), use_container_width=True)

    st.markdown("---")

    # ── Run Controls ──────────────────────────────────────────────────────────
    if not api_key:
        st.warning("⚠️ Enter your OpenAI API key in the sidebar to run the analysis.")
        st.stop()

    run_col, hint_col = st.columns([1, 3])
    with run_col:
        run_button = st.button(
            "🚀 Run Analysis",
            type="primary",
            use_container_width=True,
        )
    with hint_col:
        st.caption("Analysis typically takes 3–8 minutes. The page will update automatically when done.")

    # Clear previous results when a new run is triggered
    if run_button:
        st.session_state.pop("results", None)
        st.session_state.pop("log", None)

        with st.status("🤖 Running multi-agent analysis pipeline…", expanded=True) as status:
            st.write("Sending data to agents — please wait…")
            try:
                result, log = run_analysis(df, api_key)
                st.session_state["results"] = result
                st.session_state["log"] = log
                status.update(label="✅ Analysis complete!", state="complete", expanded=False)
                st.rerun()
            except Exception as exc:
                status.update(label="❌ Analysis failed", state="error", expanded=True)
                st.error(str(exc))
                st.exception(exc)

    # ── Results ───────────────────────────────────────────────────────────────
    if "results" not in st.session_state:
        st.stop()

    result = st.session_state["results"]
    log = st.session_state.get("log", "")

    semantic_model = result.get("semantic_model")
    questions_output = result.get("questions")
    answers = result.get("answers") or []
    insights = result.get("insights")
    refinement = result.get("refinement")
    manager_log = result.get("manager_log") or []

    tab_insights, tab_findings, tab_questions, tab_schema, tab_log = st.tabs(
        ["📊 Insights Report", "🔍 Data Findings", "❓ Questions", "🗂 Semantic Model", "📋 Pipeline Log"]
    )

    # ── Tab 1: Insights Report ────────────────────────────────────────────────
    with tab_insights:
        if not insights:
            st.info("No insights available.")
        else:
            # Executive Summary
            st.subheader("Executive Summary")
            st.info(insights.executive_summary)

            st.markdown("---")

            # Action Items
            st.subheader("Action Items")

            priority_style = {
                "High":   ("priority-high",   "🔴 High Priority"),
                "Medium": ("priority-medium",  "🟡 Medium Priority"),
                "Low":    ("priority-low",     "🟢 Low Priority"),
            }

            for i, action in enumerate(insights.action_items, 1):
                css_class, badge = priority_style.get(
                    action.priority, ("priority-low", action.priority)
                )
                with st.expander(
                    f"{badge} — {action.title}",
                    expanded=(action.priority == "High"),
                ):
                    left, right = st.columns(2)
                    with left:
                        st.markdown('<p class="label">What\'s Happening</p>', unsafe_allow_html=True)
                        st.write(action.what)
                        st.markdown('<p class="label">Why It Matters</p>', unsafe_allow_html=True)
                        st.write(action.why_it_matters)
                    with right:
                        st.markdown('<p class="label">Recommendation</p>', unsafe_allow_html=True)
                        st.write(action.recommendation)
                        st.markdown('<p class="label">Expected Impact</p>', unsafe_allow_html=True)
                        st.write(action.expected_impact)

            st.markdown("---")

            # Watch Out For
            st.subheader("⚠️ Watch Out For")
            for warning in insights.watch_out_for:
                st.warning(warning)

    # ── Tab 2: Data Findings ──────────────────────────────────────────────────
    with tab_findings:
        if not answers:
            st.info("No query results available.")
        else:
            good = [a for a in answers if not a.error]
            bad = [a for a in answers if a.error]

            m1, m2, m3 = st.columns(3)
            m1.metric("Total Questions", len(answers))
            m2.metric("Successful Queries", len(good))
            m3.metric("Failed Queries", len(bad))

            st.markdown("---")

            # Group by success/failure
            if good:
                st.markdown("#### ✅ Successful Queries")
                for a in good:
                    with st.expander(a.question):
                        st.markdown('<p class="label">Pandas Query</p>', unsafe_allow_html=True)
                        st.code(a.query, language="python")
                        st.markdown('<p class="label">Actual Result</p>', unsafe_allow_html=True)
                        st.text(a.actual_result)
                        st.markdown('<p class="label">Business Explanation</p>', unsafe_allow_html=True)
                        st.write(a.explanation)

            if bad:
                st.markdown("#### ❌ Failed Queries")
                for a in bad:
                    with st.expander(a.question):
                        st.error(f"Error: {a.error}")
                        if a.query:
                            st.code(a.query, language="python")

    # ── Tab 3: Questions ──────────────────────────────────────────────────────
    with tab_questions:
        if not questions_output:
            st.info("No questions available.")
        else:
            st.markdown(f"**Dataset Understanding:** {questions_output.dataset_understanding}")
            st.caption(f"{len(questions_output.questions)} questions generated")
            st.markdown("---")

            by_category: dict = defaultdict(list)
            for q in questions_output.questions:
                by_category[q.category].append(q)

            priority_count = sum(1 for q in questions_output.questions if q.priority)
            st.caption(f"⭐ {priority_count} high-priority questions")

            for category, qs in by_category.items():
                with st.expander(f"**{category}** — {len(qs)} question(s)", expanded=False):
                    for q in qs:
                        if q.priority:
                            st.markdown(f"⭐ **{q.question}**")
                            if q.priority_reason:
                                st.caption(f"   *{q.priority_reason}*")
                        else:
                            st.markdown(f"• {q.question}")

    # ── Tab 4: Semantic Model ─────────────────────────────────────────────────
    with tab_schema:
        if not semantic_model:
            st.info("No semantic model available.")
        else:
            col1, col2 = st.columns(2)
            col1.metric("Dataset", semantic_model.dataset_name)
            col2.metric("Row Count", f"{semantic_model.row_count:,}")

            st.markdown("---")
            st.markdown("#### Column Definitions")

            schema_rows = []
            for col in semantic_model.columns:
                schema_rows.append(
                    {
                        "Column": col.name,
                        "Type": col.dtype,
                        "Role": col.role,
                        "Description": col.description,
                        "Unit": col.unit or "—",
                    }
                )
            st.dataframe(pd.DataFrame(schema_rows), use_container_width=True, hide_index=True)

            if semantic_model.primary_keys:
                st.markdown(f"**Primary Keys:** `{'`, `'.join(semantic_model.primary_keys)}`")
            if semantic_model.time_column:
                st.markdown(f"**Time Column:** `{semantic_model.time_column}`")

            missing_nonzero = {
                k: v for k, v in semantic_model.missing_values.items() if v > 0
            }
            if missing_nonzero:
                st.markdown("#### Missing Values")
                st.dataframe(
                    pd.DataFrame(
                        [{"Column": k, "Missing Count": v} for k, v in missing_nonzero.items()]
                    ),
                    use_container_width=True,
                    hide_index=True,
                )
            else:
                st.success("No missing values detected.")

    # ── Tab 5: Pipeline Log ───────────────────────────────────────────────────
    with tab_log:
        st.markdown("#### Manager Routing Log")
        for entry in manager_log:
            st.text(f"  {entry}")

        if refinement:
            st.markdown("---")
            st.markdown("#### Final Refinement Decision")
            status_label = (
                "✅ Approved — no further refinement needed"
                if not refinement.needs_refinement
                else f"↺ Requested re-run of `{refinement.target_agent}`"
            )
            st.markdown(f"**Status:** {status_label}")
            st.markdown(f"**Reasoning:** {refinement.reasoning}")

        if log:
            st.markdown("---")
            with st.expander("Full agent output log", expanded=False):
                st.code(log, language=None)
